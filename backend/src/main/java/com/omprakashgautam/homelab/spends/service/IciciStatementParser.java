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
 * File format:
 *   Rows 1–12: header metadata (account number, holder name, etc.)
 *   Row 13:    column header row (ignored)
 *   Row 14+:   transaction data
 *
 * Column order (0-indexed):
 *   0 – S.No.
 *   1 – Value Date       (dd/MM/yyyy)
 *   2 – Transaction Date (dd/MM/yyyy)
 *   3 – Cheque Number
 *   4 – Transaction Remarks
 *   5 – Withdrawal Amount (INR)
 *   6 – Deposit Amount (INR)
 *   7 – Balance (INR)
 */
@Slf4j
@Component
public class IciciStatementParser {

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy");

    // Header rows contain these markers
    private static final String ACCOUNT_NO_MARKER = "Account No";
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

        // Scan the first 12 rows for account metadata
        for (int i = 0; i <= 11 && i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;

            String cellText = cellText(row, 0);
            if (cellText.contains(ACCOUNT_NO_MARKER)) {
                accountNumber = extractAfterColon(cellText(row, 1));
                if (accountNumber == null || accountNumber.isBlank()) {
                    // Try same cell, split by ':'
                    accountNumber = extractAfterColon(cellText);
                }
                accountNumber = maskAccountNumber(accountNumber);
            } else if (cellText.contains(ACCOUNT_NAME_MARKER)) {
                accountHolderName = extractAfterColon(cellText(row, 1));
                if (accountHolderName == null || accountHolderName.isBlank()) {
                    accountHolderName = extractAfterColon(cellText);
                }
                if (accountHolderName != null) {
                    accountHolderName = accountHolderName.trim();
                }
            }
        }

        // Data starts from row index 13 (0-based), row 14 in the file.
        // Row 13 (index 12) is the column header row.
        List<ParsedTransaction> transactions = new ArrayList<>();
        int dataStartRow = 13;

        for (int i = dataStartRow; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;

            String sno = cellText(row, 0);
            if (sno.isBlank()) continue; // blank S.No. = end of data or empty row

            try {
                LocalDate valueDate      = parseDate(cellText(row, 1));
                LocalDate transactionDate = parseDate(cellText(row, 2));
                String chequeNumber      = cellText(row, 3);
                String rawRemarks        = cellText(row, 4);
                BigDecimal withdrawal    = parseMoney(row, 5);
                BigDecimal deposit       = parseMoney(row, 6);
                BigDecimal balance       = parseMoney(row, 7);

                if (valueDate == null || transactionDate == null) {
                    log.debug("Skipping row {} — could not parse dates", i + 1);
                    continue;
                }

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

        return new ParsedStatement(
                "ICICI Bank",
                accountNumber,
                accountHolderName,
                "Savings",
                transactions
        );
    }

    private String cellText(Row row, int col) {
        Cell cell = row.getCell(col, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING  -> cell.getStringCellValue().trim();
            case NUMERIC -> {
                if (DateUtil.isCellDateFormatted(cell)) {
                    // Some versions encode dates as numbers
                    yield cell.getLocalDateTimeCellValue().toLocalDate()
                            .format(DATE_FMT);
                }
                // Format as plain number to avoid scientific notation
                double val = cell.getNumericCellValue();
                yield val == Math.floor(val) && !Double.isInfinite(val)
                        ? String.valueOf((long) val)
                        : String.valueOf(val);
            }
            case FORMULA -> {
                try { yield String.valueOf(cell.getNumericCellValue()); }
                catch (Exception e) { yield cell.getStringCellValue().trim(); }
            }
            default -> "";
        };
    }

    private LocalDate parseDate(String text) {
        if (text == null || text.isBlank()) return null;
        try {
            return LocalDate.parse(text.trim(), DATE_FMT);
        } catch (DateTimeParseException e) {
            log.debug("Cannot parse date '{}': {}", text, e.getMessage());
            return null;
        }
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
        if (idx < 0) return text.trim();
        return text.substring(idx + 1).trim();
    }

    /**
     * Masks all but the last 4 digits of an account number.
     * "123456789012" → "XXXXXXXX9012"
     */
    private String maskAccountNumber(String raw) {
        if (raw == null || raw.isBlank()) return raw;
        raw = raw.trim();
        if (raw.length() <= 4) return raw;
        return "X".repeat(raw.length() - 4) + raw.substring(raw.length() - 4);
    }
}
