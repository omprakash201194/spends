package com.omprakashgautam.homelab.spends.dto;

import java.math.BigDecimal;
import java.util.List;

public class RecurringDto {

    public enum Frequency {
        MONTHLY
    }

    public record RecurringPattern(
            String merchantName,
            String categoryName,
            String categoryColor,
            Frequency frequency,
            BigDecimal averageAmount,
            int occurrences,
            String lastMonth,       // "yyyy-MM"
            String nextExpected,    // "yyyy-MM" — predicted next occurrence
            boolean activeThisMonth
    ) {}

    public record RecurringSummary(
            String month,                      // "April 2025"
            List<RecurringPattern> patterns
    ) {}
}
