package com.omprakashgautam.homelab.spends.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public class SavingsGoalDto {

    public record CreateRequest(
            String name,
            BigDecimal target,
            LocalDate startDate,
            LocalDate targetDate   // nullable — no deadline
    ) {}

    public record GoalResponse(
            UUID id,
            String name,
            BigDecimal target,
            LocalDate startDate,
            LocalDate targetDate,  // nullable
            BigDecimal saved,      // net savings clamped to >= 0
            int percentage,        // 0–100, capped at 100
            boolean achieved       // saved >= target
    ) {}
}
