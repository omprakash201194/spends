package com.omprakashgautam.homelab.spends.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public class DashboardDto {

    // ── Lifetime overview (home page) ────────────────────────────────────────

    public record LifetimeSummary(
            long totalTransactions,
            BigDecimal totalAmount,        // withdrawals + deposits across all time
            BigDecimal totalWithdrawals,
            BigDecimal totalDeposits,
            LocalDate dateStart,           // earliest valueDate, nullable for empty accounts
            LocalDate dateEnd              // latest valueDate, nullable for empty accounts
    ) {}

    public record CategoryAmount(
            String name,
            String color,
            BigDecimal amount
    ) {}

    public record BankActivity(
            String bankName,
            BigDecimal totalAmount,
            long transactionCount
    ) {}

    /** One point in the 24-month trend chart on the lifetime dashboard. */
    public record MonthlyPoint(
            String month,                  // "yyyy-MM"
            BigDecimal withdrawals,
            BigDecimal deposits
    ) {}

    public record YearlyPoint(
            int year,
            BigDecimal withdrawals
    ) {}

    public record Lifetime(
            LifetimeSummary summary,
            List<CategoryAmount> categories,
            List<BankActivity> banks,
            List<MonthlyPoint> monthlyTrends,   // last 24 months, oldest → newest
            List<YearlyPoint> yearly
    ) {}

    // ── Month-anchored summary (legacy, still used by the custom dashboard list) ─

    public record CategoryStat(
            String name,
            String color,
            BigDecimal amount
    ) {}

    public record MonthlyTrend(
            String month,       // "Jan", "Feb", …
            String yearMonth,   // "2025-01" for sorting/keying
            BigDecimal spent,
            BigDecimal income
    ) {}

    public record MerchantStat(
            String merchant,
            BigDecimal amount,
            long count
    ) {}

    /**
     * Aggregate totals for a comparison period (prev month or prev year same month).
     */
    public record Comparison(
            BigDecimal spent,
            BigDecimal income,
            long transactionCount
    ) {}

    public record Summary(
            String month,               // "April 2025"
            BigDecimal totalSpent,
            BigDecimal totalIncome,
            BigDecimal netSavings,
            long transactionCount,
            List<CategoryStat> categoryBreakdown,
            List<MonthlyTrend> monthlyTrend,
            List<MerchantStat> topMerchants,
            Comparison prevMonth,       // aggregates for the month before anchor
            Comparison prevYear         // aggregates for same month one year ago
    ) {}
}
