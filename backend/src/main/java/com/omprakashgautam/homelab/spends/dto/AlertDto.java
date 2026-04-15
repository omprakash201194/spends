package com.omprakashgautam.homelab.spends.dto;

import java.math.BigDecimal;
import java.util.List;

public class AlertDto {

    public enum AlertType {
        LARGE_TRANSACTION,
        NEW_MERCHANT,
        CATEGORY_SPIKE
    }

    public record Alert(
            AlertType type,
            String title,    // merchant name or category name
            String message,  // human-readable detail
            BigDecimal amount
    ) {}

    public record AlertSummary(
            String month,
            List<Alert> alerts
    ) {}
}
