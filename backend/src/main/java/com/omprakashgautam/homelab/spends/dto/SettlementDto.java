package com.omprakashgautam.homelab.spends.dto;

import com.omprakashgautam.homelab.spends.model.SettlementStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class SettlementDto {

    public record ItemRequest(
        UUID transactionId,
        @NotBlank String description,
        @NotNull BigDecimal totalAmount,
        @NotNull BigDecimal yourShare
    ) {}

    public record CreateRequest(
        @NotBlank String participantName,
        String description,
        List<ItemRequest> items
    ) {}

    public record ItemResponse(
        UUID id,
        UUID transactionId,
        String description,
        BigDecimal totalAmount,
        BigDecimal yourShare
    ) {}

    public record Response(
        UUID id,
        String participantName,
        String description,
        SettlementStatus status,
        BigDecimal totalOwed,
        List<ItemResponse> items,
        LocalDateTime createdAt,
        LocalDateTime settledAt
    ) {}
}
