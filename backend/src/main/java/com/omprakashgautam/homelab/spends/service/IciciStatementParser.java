package com.omprakashgautam.homelab.spends.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

/**
 * Parses ICICI bank statement XLS/XLSX files.
 *
 * Column order (0-indexed):
 *   0 – S.No.
 *   1 – Value Date
 *   2 – Transaction Date
 *   3 – Cheque Number
 *   4 – Transaction Remarks
 *   5 – Withdrawal Amount (INR)
 *   6 – Deposit Amount (INR)
 *   7 – Balance (INR)
 *
 * The parser auto-detects where data rows begin (typically rows 13–14 in
 * different ICICI statement versions) by scanning for the first row that
 * has a parseable date in column 1.
 */
@Slf4j
@Component
public class IciciStatementParser {

    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("d/MM/yyyy"),
            DateTimeFormatter.ofPattern("dd-MMM-yyyy"),
            DateTimeFormatter.ofPattern("d-MMM-yyyy"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd")
    );

    private static final String ACCOUNT_NO_MARKER   = "Account No";
    private static final String ACCOUNT_NAME_MARKER = "Account Name";

    public record ParsedStatement(
            String bankName,
            String accountNumberMasked,
            String accountHolderName,
            String accountType,
            List<ParsedTransaction> transactions
    ) {}

    public record ParsedTransaction(
            LocalDate valueDate,
            LocalDate transactionDate,
            String chequeNumber,
            String rawRemarks,
            BigDecimal withdrawalAmount,
            BigDecimal depositAmount,
            BigDecimal balance
    ) {}

    public ParsedStatement parse(MultipartFile file) throws IOException {
        String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();

        try (InputStream is = file.getInputStream();
             Workbook workbook = filename.endsWith(".xlsx")
                     ? new XSSFWorkbook(is)
                     : new HSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            return parseSheet(sheet);
        }
    }

    private ParsedStatement parseSheet(Sheet sheet) {
        String accountNumber = null;
        String accountHolderName = null;

        // Scan up to the first 15 rows for account metadata
        int metaLimit = Math.min(15, sheet.getLastRowNum());
        for (int i = 0; i <= metaLimit; i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;

            String c0 = cellText(row, 0);
            String c1 = cellText(row, 1);

            if (c0.contains(ACCOUNT_NO_MARKER)) {
                accountNumber = maskAccountNumber(extractAfterColon(c1.isBlank() ? c0 : c1));
            } else if (c0.contains(ACCOUNT_NAME_MARKER)) {
                String raw = extractAfterColon(c1.isBlank() ? c0 : c1);
                if (raw != null) accountHolderName = raw.trim();
            }
        }

        // Auto-detect the first row that has a parseable date in column 1 (Value Date).
        // Skip the header and column-title rows without hardcoding a row number.
        int dataStartRow = detectDataStartRow(sheet);
        log.debug("Detected data start row (0-based): {}", dataStartRow);

        List<ParsedTransaction> transactions = new ArrayList<>();

        for (int i = dataStartRow; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;

            // Stop at first completely blank row after data has started
            if (isRowBlank(row)) {
                if (!transactions.isEmpty()) break;
                continue;
            }

            try {
                LocalDate valueDate       = parseDate(row, 1);
                LocalDate transactionDate = parseDate(row, 2);

                if (valueDate == null || transactionDate == null) {
                    log.debug("Skipping row {} — could not parse dates (valueDate='{}', txDate='{}')",
                            i + 1, cellText(row, 1), cellText(row, 2));
                    continue;
                }

                String chequeNumber  = cellText(row, 3);
                String rawRemarks    = cellText(row, 4);
                BigDecimal withdrawal = parseMoney(row, 5);
                BigDecimal deposit    = parseMoney(row, 6);
                BigDecimal balance    = parseMoney(row, 7);

                transactions.add(new ParsedTransaction(
                        valueDate, transactionDate,
                        chequeNumber.isBlank() ? null : chequeNumber,
                        rawRemarks,
                        withdrawal, deposit, balance
                ));
            } catch (Exception e) {
                log.warn("Skipping row {} due to parse error: {}", i + 1, e.getMessage());
            }
        }

        log.info("Parsed {} transactions from sheet (data start row {})", transactions.size(), dataStartRow);
        return new ParsedStatement(
                "ICICI Bank",
                accountNumber,
                accountHolderName,
                "Savings",
                transactions
        );
    }

    /**
     * Finds the first row index (0-based) where column 1 contains a parseable date.
     * This handles different ICICI statement versions without hardcoding row numbers.
     */
    private int detectDataStartRow(Sheet sheet) {
        for (int i = 0; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            // Skip if column 0 is blank (S.No. is missing) — header rows often have labels
            // but if it's a numeric S.No. and column 1 has a date, this is a data row
            LocalDate date = parseDate(row, 1);
            if (date != null) {
                // Extra sanity: the date should be reasonable (2000–2030)
                int year = date.getYear();
                if (year >= 2000 && year <= 2030) {
                    return i;
                }
            }
        }
        // Fallback: start at row 13 (0-based) as originally assumed
        log.warn("Could not auto-detect data start row, falling back to row index 13");
        return 13;
    }

    private boolean isRowBlank(Row row) {
        for (int c = 0; c <= 7; c++) {
            if (!cellText(row, c).isBlank()) return false;
        }
        return true;
    }

    private String cellText(Row row, int col) {
        Cell cell = row.getCell(col, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING  -> cell.getStringCellValue().trim();
            case NUMERIC -> {
                if (DateUtil.isCellDateFormatted(cell)) {
                    LocalDate d = cell.getLocalDateTimeCellValue().toLocalDate();
                    yield d.format(DATE_FORMATS.get(0)); // dd/MM/yyyy
                }
                double val = cell.getNumericCellValue();
                yield val == Math.floor(val) && !Double.isInfinite(val)
                        ? String.valueOf((long) val)
                        : String.valueOf(val);
            }
            case FORMULA -> {
                try { yield String.valueOf((long) cell.getNumericCellValue()); }
                catch (Exception e) { yield cell.getStringCellValue().trim(); }
            }
            default -> "";
        };
    }

    private LocalDate parseDate(Row row, int col) {
        Cell cell = row.getCell(col, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) return null;

        // Native Excel date — most reliable
        if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            return cell.getLocalDateTimeCellValue().toLocalDate();
        }

        String text = cellText(row, col).trim();
        if (text.isBlank()) return null;

        for (DateTimeFormatter fmt : DATE_FORMATS) {
            try {
                return LocalDate.parse(text, fmt);
            } catch (DateTimeParseException ignored) {}
        }

        log.debug("Could not parse date string '{}' with any known format", text);
        return null;
    }

    private BigDecimal parseMoney(Row row, int col) {
        Cell cell = row.getCell(col, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) return BigDecimal.ZERO;
        try {
            if (cell.getCellType() == CellType.NUMERIC) {
                return BigDecimal.valueOf(cell.getNumericCellValue());
            }
            String text = cell.getStringCellValue().trim().replace(",", "");
            return text.isBlank() ? BigDecimal.ZERO : new BigDecimal(text);
        } catch (Exception e) {
            return BigDecimal.ZERO;
        }
    }

    private String extractAfterColon(String text) {
        if (text == null) return null;
        int idx = text.indexOf(':');
        return idx < 0 ? text.trim() : text.substring(idx + 1).trim();
    }

    private String maskAccountNumber(String raw) {
        if (raw == null || raw.isBlank()) return raw;
        raw = raw.trim();
        if (raw.length() <= 4) return raw;
        return "X".repeat(raw.length() - 4) + raw.substring(raw.length() - 4);
    }
}
