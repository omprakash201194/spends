package com.omprakashgautam.homelab.spends.dto;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public class AnnualBudgetDto {

    public record Response(
        UUID id,
        UUID categoryId,
        String categoryName,
        String categoryIcon,
        int year,
        BigDecimal amount,
        BigDecimal spent
    ) {}

    public record SetRequest(
        @NotNull UUID categoryId,
        int year,
        @NotNull BigDecimal amount
    ) {}
}
