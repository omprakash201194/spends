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
 * Parses ICICI bank statement XLS files exported from internet banking.
 *
 * Actual column layout (0-indexed) — column 0 is always blank:
 *   0 – blank
 *   1 – S No.
 *   2 – Value Date        (dd/MM/yyyy)
 *   3 – Transaction Date  (dd/MM/yyyy)
 *   4 – Cheque Number
 *   5 – Transaction Remarks
 *   6 – Withdrawal Amount (INR)
 *   7 – Deposit Amount (INR)
 *   8 – Balance (INR)
 *
 * Header rows (1-based):
 *   Row  1 : blank
 *   Row  2 : "DETAILED STATEMENT"
 *   Row  4 : "Account Number" | blank | "187501504556 ( INR ) - OMPRAKASH HARISH"
 *   Row 12 : "Transactions List - <NAME>"
 *   Row 13 : column headers
 *   Row 14+: transaction data
 */
@Slf4j
@Component
public class IciciStatementParser {

    // Column indices
    private static final int COL_VALUE_DATE = 2;
    private static final int COL_TX_DATE    = 3;
    private static final int COL_CHEQUE     = 4;
    private static final int COL_REMARKS    = 5;
    private static final int COL_WITHDRAWAL = 6;
    private static final int COL_DEPOSIT    = 7;
    private static final int COL_BALANCE    = 8;

    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("d/MM/yyyy"),
            DateTimeFormatter.ofPattern("dd-MMM-yyyy"),
            DateTimeFormatter.ofPattern("d-MMM-yyyy"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd")
    );

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

        // Scan first 15 rows for account metadata.
        // Account number row: col1="Account Number", col3="187501504556 ( INR ) - OMPRAKASH HARISH"
        for (int i = 0; i <= Math.min(15, sheet.getLastRowNum()); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;

            String c1 = cellText(row, 1);
            String c3 = cellText(row, 3);

            if (c1.contains("Account Number") && !c3.isBlank()) {
                // c3 looks like: "187501504556 ( INR )  - OMPRAKASH HARISH"
                String[] parts = c3.split("-", 2);
                String rawAccNo = parts[0].replaceAll("[^0-9]", "").trim();
                accountNumber = maskAccountNumber(rawAccNo);
                if (parts.length > 1) {
                    accountHolderName = parts[1].trim();
                }
            }
        }

        // Detect data start row: first row where col2 (Value Date) has a parseable date
        int dataStartRow = detectDataStartRow(sheet);
        log.info("ICICI parser: data starts at row {} (0-based), account={}, holder={}",
                dataStartRow, accountNumber, accountHolderName);

        List<ParsedTransaction> transactions = new ArrayList<>();

        for (int i = dataStartRow; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;

            if (isRowBlank(row)) {
                if (!transactions.isEmpty()) break;
                continue;
            }

            try {
                LocalDate valueDate       = parseDate(row, COL_VALUE_DATE);
                LocalDate transactionDate = parseDate(row, COL_TX_DATE);

                if (valueDate == null || transactionDate == null) {
                    log.debug("Skipping row {} — unparseable dates: valueDate='{}' txDate='{}'",
                            i + 1, cellText(row, COL_VALUE_DATE), cellText(row, COL_TX_DATE));
                    continue;
                }

                String chequeNumber = cellText(row, COL_CHEQUE);
                String rawRemarks   = cellText(row, COL_REMARKS);
                BigDecimal withdrawal = parseMoney(row, COL_WITHDRAWAL);
                BigDecimal deposit    = parseMoney(row, COL_DEPOSIT);
                BigDecimal balance    = parseMoney(row, COL_BALANCE);

                transactions.add(new ParsedTransaction(
                        valueDate, transactionDate,
                        chequeNumber.isBlank() ? null : chequeNumber,
                        rawRemarks,
                        withdrawal, deposit, balance
                ));
            } catch (Exception e) {
                log.warn("Skipping row {} — parse error: {}", i + 1, e.getMessage());
            }
        }

        log.info("ICICI parser: parsed {} transactions", transactions.size());
        return new ParsedStatement(
                "ICICI Bank",
                accountNumber,
                accountHolderName,
                "Savings",
                transactions
        );
    }

    /**
     * Finds the first row where COL_VALUE_DATE contains a parseable date.
     * Scans from row 10 onwards to skip obvious header rows.
     */
    private int detectDataStartRow(Sheet sheet) {
        for (int i = 10; i <= Math.min(sheet.getLastRowNum(), 30); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            LocalDate date = parseDate(row, COL_VALUE_DATE);
            if (date != null && date.getYear() >= 2000 && date.getYear() <= 2035) {
                return i;
            }
        }
        log.warn("Could not auto-detect data start row — falling back to index 13");
        return 13;
    }

    private boolean isRowBlank(Row row) {
        for (int c = 0; c <= COL_BALANCE; c++) {
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
                    yield cell.getLocalDateTimeCellValue().toLocalDate().format(DATE_FORMATS.get(0));
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

        if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            return cell.getLocalDateTimeCellValue().toLocalDate();
        }

        String text = cellText(row, col).trim();
        if (text.isBlank()) return null;

        for (DateTimeFormatter fmt : DATE_FORMATS) {
            try { return LocalDate.parse(text, fmt); }
            catch (DateTimeParseException ignored) {}
        }

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

    private String maskAccountNumber(String raw) {
        if (raw == null || raw.isBlank()) return raw;
        if (raw.length() <= 4) return raw;
        return "X".repeat(raw.length() - 4) + raw.substring(raw.length() - 4);
    }
}
