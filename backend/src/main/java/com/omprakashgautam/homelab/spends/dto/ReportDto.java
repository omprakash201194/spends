package com.omprakashgautam.homelab.spends.dto;

import java.math.BigDecimal;
import java.util.List;

public class ReportDto {

    public record CategoryRow(
            String category,
            String color,
            BigDecimal amount
    ) {}

    public record MonthRow(
            String yearMonth,     // "2025-04"
            String monthLabel,    // "April 2025"
            BigDecimal totalSpent,
            BigDecimal totalIncome,
            BigDecimal net,
            List<CategoryRow> categories
    ) {}

    public record YearSummary(
            int year,
            List<MonthRow> months,
            BigDecimal grandTotalSpent,
            BigDecimal grandTotalIncome
    ) {}
}
