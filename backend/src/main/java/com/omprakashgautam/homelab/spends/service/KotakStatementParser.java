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
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Parses Kotak Mahindra Bank account statement CSV files exported from Net Banking.
 *
 * Column layout (0-indexed after Apache Commons CSV parsing):
 *   0  – #                  (sequence number; "-" for opening balance, blank for continuation row)
 *   1  – Date               (d MMM yyyy, e.g. "03 Jan 2026")
 *   2  – Description        (narration; may wrap across rows)
 *   3  – Chq/Ref. No.       (UPI ref, e.g. "UPI-600381736737")
 *   4  – Withdrawal (Dr.)
 *   5  – Deposit (Cr.)
 *   6  – Balance
 *
 * Multi-line wrap: a continuation row has blank col[0] and col[1], with a non-blank col[2].
 * The col[2] fragment is appended to the previous transaction's rawRemarks separated by a space.
 *
 * Page footer rows ("Statement Generated on ...") repeat per page and are skipped.
 * Account numbers are masked to "first 3 + X middle + last 3" before storage.
 */
@Slf4j
@Component
public class KotakStatementParser {

    private static final int COL_SEQ         = 0;
    private static final int COL_DATE        = 1;
    private static final int COL_DESCRIPTION = 2;
    private static final int COL_CHEQ_REF    = 3;
    private static final int COL_WITHDRAWAL  = 4;
    private static final int COL_DEPOSIT     = 5;
    private static final int COL_BALANCE     = 6;

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

    public ParsedStatement parse(MultipartFile file) throws IOException {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            List<CSVRecord> records = CSVFormat.DEFAULT.parse(reader).getRecords();
            return parseRecords(records);
        }
    }

    private ParsedStatement parseRecords(List<CSVRecord> records) {
        String accountHolderName = null;
        String accountNumberMasked = null;
        int dataStartIdx = -1;

        for (int i = 0; i < records.size(); i++) {
            CSVRecord rec = records.get(i);
            String col0 = get(rec, 0).trim();
            String col1 = get(rec, 1).trim();
            String col4 = get(rec, 4).trim();

            // Holder name: row where col[4] starts with "Account No." → col[0] is the holder name.
            if (col4.startsWith("Account No.")) {
                accountHolderName = col0;
                String digits = col4.replaceAll("[^0-9]", "");
                accountNumberMasked = maskAccount(digits);
            }

            // Header row: col[0] == "#" AND col[1] == "Date"
            if ("#".equals(col0) && "Date".equalsIgnoreCase(col1)) {
                dataStartIdx = i + 1;
                break;
            }
        }

        if (dataStartIdx == -1) {
            throw new IllegalStateException(
                    "Could not find transaction header row in Kotak CSV");
        }

        log.info("Kotak parser: data starts at index {}, account={}, holder={}",
                dataStartIdx, accountNumberMasked, accountHolderName);

        List<ParsedStatement.ParsedTransaction> transactions = new ArrayList<>();

        for (int i = dataStartIdx; i < records.size(); i++) {
            CSVRecord rec = records.get(i);
            String col0 = get(rec, 0).trim();

            if (isNumeric(col0)) {
                try {
                    LocalDate date = LocalDate.parse(get(rec, COL_DATE).trim(), DATE_FMT);
                    String description = get(rec, COL_DESCRIPTION).trim();
                    String chequeRef   = get(rec, COL_CHEQ_REF).trim();
                    BigDecimal withdrawal = parseMoney(get(rec, COL_WITHDRAWAL));
                    BigDecimal deposit    = parseMoney(get(rec, COL_DEPOSIT));
                    BigDecimal balance    = parseMoney(get(rec, COL_BALANCE));

                    transactions.add(new ParsedStatement.ParsedTransaction(
                            date, date,
                            chequeRef.isBlank() ? null : chequeRef,
                            description,
                            withdrawal, deposit, balance
                    ));
                } catch (Exception e) {
                    log.warn("Kotak parser: skipping row {}: {}", i, e.getMessage());
                }
            } else if (isContinuationRow(rec) && !transactions.isEmpty()) {
                ParsedStatement.ParsedTransaction last = transactions.get(transactions.size() - 1);
                String fragment = get(rec, COL_DESCRIPTION).trim();
                String merged = last.rawRemarks() + " " + fragment;
                transactions.set(transactions.size() - 1, new ParsedStatement.ParsedTransaction(
                        last.valueDate(), last.transactionDate(),
                        last.chequeNumber(), merged,
                        last.withdrawalAmount(), last.depositAmount(), last.balance()
                ));
            }
        }

        log.info("Kotak parser: parsed {} transactions", transactions.size());
        return new ParsedStatement(
                "Kotak Mahindra Bank",
                accountNumberMasked,
                accountHolderName,
                "Savings",
                transactions
        );
    }

    private String get(CSVRecord rec, int col) {
        return col < rec.size() ? rec.get(col) : "";
    }

    /** "4550925349" → "455XXXX349"; preserves first 3 and last 3 digits. */
    private String maskAccount(String digits) {
        if (digits == null || digits.length() < 6) return digits;
        int xs = digits.length() - 6;
        return digits.substring(0, 3) + "X".repeat(xs) + digits.substring(digits.length() - 3);
    }

    private boolean isNumeric(String s) {
        if (s == null || s.isEmpty()) return false;
        for (int i = 0; i < s.length(); i++) {
            if (!Character.isDigit(s.charAt(i))) return false;
        }
        return true;
    }

    /** Continuation row: blank seq AND blank date AND non-blank description. */
    private boolean isContinuationRow(CSVRecord rec) {
        return get(rec, COL_SEQ).trim().isEmpty()
            && get(rec, COL_DATE).trim().isEmpty()
            && !get(rec, COL_DESCRIPTION).trim().isEmpty();
    }

    private BigDecimal parseMoney(String text) {
        if (text == null || text.isBlank()) return BigDecimal.ZERO;
        String clean = text.trim().replace(",", "");
        if (clean.isBlank()) return BigDecimal.ZERO;
        try { return new BigDecimal(clean); }
        catch (NumberFormatException e) { return BigDecimal.ZERO; }
    }
}
