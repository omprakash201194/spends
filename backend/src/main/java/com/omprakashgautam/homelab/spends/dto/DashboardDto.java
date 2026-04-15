package com.omprakashgautam.homelab.spends.dto;

import java.math.BigDecimal;
import java.util.List;

public class DashboardDto {

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

    public record Summary(
            String month,               // "April 2025"
            BigDecimal totalSpent,
            BigDecimal totalIncome,
            BigDecimal netSavings,
            long transactionCount,
            List<CategoryStat> categoryBreakdown,
            List<MonthlyTrend> monthlyTrend,
            List<MerchantStat> topMerchants
    ) {}
}
