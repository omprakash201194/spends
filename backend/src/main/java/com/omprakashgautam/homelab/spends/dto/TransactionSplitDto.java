package com.omprakashgautam.homelab.spends.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public class TransactionSplitDto {

    public record SplitItem(
        UUID categoryId,
        @NotNull BigDecimal amount,
        String note
    ) {}

    public record SaveRequest(
        @NotEmpty List<SplitItem> splits
    ) {}

    public record Response(
        UUID id,
        UUID categoryId,
        String categoryName,
        BigDecimal amount,
        String note
    ) {}
}
