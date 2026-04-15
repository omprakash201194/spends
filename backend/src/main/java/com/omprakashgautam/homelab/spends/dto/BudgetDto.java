package com.omprakashgautam.homelab.spends.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public class BudgetDto {

    public record SetRequest(
            UUID categoryId,
            int year,
            int month,
            BigDecimal limit
    ) {}

    public record CategoryBudget(
            UUID budgetId,          // null if no budget set for this category
            UUID categoryId,
            String categoryName,
            String categoryColor,
            BigDecimal limit,       // null if not set
            BigDecimal spent,
            int percentage          // 0 if no limit
    ) {}

    public record MonthSummary(
            String month,       // "April 2025" — display label
            int year,
            int monthNumber,    // 1-12
            List<CategoryBudget> categories
    ) {}
}
