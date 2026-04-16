package com.omprakashgautam.homelab.spends.dto;

import java.math.BigDecimal;
import java.util.List;

public class DataHealthDto {

    /**
     * Counts and date-range stats for the user's transaction corpus.
     * earliestDate / latestDate are nullable ISO strings ("2024-01-05") — null when the user
     * has no transactions yet.
     */
    public record TransactionStats(
            long total,
            long uncategorized,
            long miscellaneous,
            String earliestDate,
            String latestDate,
            long accountCount
    ) {}

    public record RuleStats(
            long userRules,
            long globalRules
    ) {}

    /**
     * A group of transactions that share the same bank account, date, and withdrawal amount —
     * they may be accidental duplicates that slipped past the hash guard (e.g. slightly different
     * remarks strings).
     */
    public record NearDuplicate(
            String accountLabel,   // "XXXX1234 · ICICI"
            String date,           // ISO "2025-03-15"
            BigDecimal amount,
            long count
    ) {}

    public record Report(
            TransactionStats transactions,
            RuleStats rules,
            List<NearDuplicate> nearDuplicates
    ) {}
}
