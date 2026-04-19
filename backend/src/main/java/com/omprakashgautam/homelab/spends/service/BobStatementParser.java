package com.omprakashgautam.homelab.spends.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

/**
 * Parses Bank of Baroda account statement CSV files exported from internet banking.
 *
 * Column layout (0-indexed after Apache Commons CSV parsing):
 *   0  – TRAN DATE       (dd/MM/yyyy) → transactionDate
 *   2  – VALUE DATE      (dd/MM/yyyy) → valueDate
 *   4  – NARRATION       → rawRemarks
 *   7  – CHQ.NO.         → chequeNumber (null if blank)
 *   8  – WITHDRAWAL(DR)  → withdrawalAmount
 *   12 – DEPOSIT(CR)     → depositAmount
 *   14 – BALANCE(INR)    → balance (strip "Cr"/"Dr" suffix)
 *
 * Metadata detection (by content, not fixed row):
 *   col[1] contains "Holder Name" → name follows ":"
 *   col[0] starts with "Customer Id" → col[10]="Account No:", col[13]=masked account number
 *   col[0] == "TRAN DATE" → next row is first transaction row
 */
@Slf4j
@Component
public class BobStatementParser {

    private static final int COL_TX_DATE    = 0;
    private static final int COL_VALUE_DATE = 2;
    private static final int COL_NARRATION  = 4;
    private static final int COL_CHEQUE     = 7;
    private static final int COL_WITHDRAWAL = 8;
    private static final int COL_DEPOSIT    = 12;
    private static final int COL_BALANCE    = 14;

    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("d/MM/yyyy"),
            DateTimeFormatter.ofPattern("d/M/yyyy")
    );

    public ParsedStatement parse(MultipartFile file) throws IOException {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            List<CSVRecord> records = CSVFormat.DEFAULT.parse(reader).getRecords();
            return parseRecords(records);
        }
    }

    private ParsedStatement parseRecords(List<CSVRecord> records) {
        String accountHolderName = null;
        String accountNumber = null;
        int dataStartIdx = -1;

        for (int i = 0; i < records.size(); i++) {
            CSVRecord rec = records.get(i);
            String col0 = get(rec, 0);
            String col1 = get(rec, 1);

            // "Main Account  Holder Name  :OMPRAKASH GAUTAM" is in col 1
            if (col1.contains("Holder Name") && col1.contains(":")) {
                accountHolderName = col1.substring(col1.indexOf(':') + 1).trim();
            }

            // "Customer Id:,,,065937386,,,,,,,Account No:,,,368XXXXXXXX803,,"
            if (col0.startsWith("Customer Id")) {
                String acctLabel = get(rec, 10);
                if (acctLabel.contains("Account No")) {
                    accountNumber = get(rec, 13).trim();
                }
            }

            // Header row: col 0 == "TRAN DATE" → data starts next row
            if ("TRAN DATE".equalsIgnoreCase(col0.trim())) {
                dataStartIdx = i + 1;
                break;
            }
        }

        if (dataStartIdx == -1) {
            throw new IllegalStateException(
                    "Could not find transaction header row in Bank of Baroda CSV");
        }

        log.info("BoB parser: data starts at index {}, account={}, holder={}",
                dataStartIdx, accountNumber, accountHolderName);

        List<ParsedStatement.ParsedTransaction> transactions = new ArrayList<>();

        for (int i = dataStartIdx; i < records.size(); i++) {
            CSVRecord rec = records.get(i);
            String col0 = get(rec, 0).trim();

            if (col0.isBlank()) continue;

            // Footer rows have a datetime like "18/04/2026 23:24" (contains space) — stop
            if (!looksLikeDate(col0)) break;

            try {
                LocalDate txDate    = parseDate(col0);
                LocalDate valueDate = parseDate(get(rec, COL_VALUE_DATE));

                if (txDate == null || valueDate == null) {
                    log.debug("BoB parser: skipping row {} — unparseable dates col0='{}'", i, col0);
                    continue;
                }

                String cheque    = get(rec, COL_CHEQUE).trim();
                String narration = get(rec, COL_NARRATION).trim();
                BigDecimal withdrawal = parseMoney(get(rec, COL_WITHDRAWAL));
                BigDecimal deposit    = parseMoney(get(rec, COL_DEPOSIT));
                BigDecimal balance    = parseBalance(get(rec, COL_BALANCE));

                transactions.add(new ParsedStatement.ParsedTransaction(
                        valueDate, txDate,
                        cheque.isBlank() ? null : cheque,
                        narration,
                        withdrawal, deposit, balance
                ));
            } catch (Exception e) {
                log.warn("BoB parser: skipping row {}: {}", i, e.getMessage());
            }
        }

        log.info("BoB parser: parsed {} transactions", transactions.size());
        return new ParsedStatement(
                "Bank of Baroda",
                accountNumber,
                accountHolderName,
                "Savings",
                transactions
        );
    }

    /** True only for plain dates like "05/11/2012" or "5/1/2012" — no space, two slashes, 8–10 chars. */
    private boolean looksLikeDate(String s) {
        if (s.length() < 8 || s.length() > 10) return false;
        if (s.contains(" ")) return false;
        int first = s.indexOf('/');
        if (first == -1) return false;
        int second = s.indexOf('/', first + 1);
        return second != -1;
    }

    private String get(CSVRecord rec, int col) {
        return col < rec.size() ? rec.get(col) : "";
    }

    private LocalDate parseDate(String text) {
        if (text == null || text.isBlank()) return null;
        String trimmed = text.trim();
        for (DateTimeFormatter fmt : DATE_FORMATS) {
            try { return LocalDate.parse(trimmed, fmt); }
            catch (DateTimeParseException ignored) {}
        }
        return null;
    }

    private BigDecimal parseMoney(String text) {
        if (text == null || text.isBlank()) return BigDecimal.ZERO;
        String clean = text.trim().replace(",", "");
        if (clean.isBlank()) return BigDecimal.ZERO;
        try { return new BigDecimal(clean); }
        catch (NumberFormatException e) { return BigDecimal.ZERO; }
    }

    private BigDecimal parseBalance(String text) {
        if (text == null || text.isBlank()) return BigDecimal.ZERO;
        String trimmed = text.trim();
        boolean debit = trimmed.toUpperCase().endsWith("DR");
        String clean = trimmed.replaceAll("[^0-9.]", "");
        if (clean.isBlank()) return BigDecimal.ZERO;
        try {
            BigDecimal value = new BigDecimal(clean);
            return debit ? value.negate() : value;
        } catch (NumberFormatException e) { return BigDecimal.ZERO; }
    }
}
