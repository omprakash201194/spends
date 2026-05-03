package com.omprakashgautam.homelab.spends.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public class CustomDashboardDto {

    public record CreateRequest(@NotBlank String name) {}

    public record RenameRequest(@NotBlank String name) {}

    public record UpdateFiltersRequest(
            UUID accountId,
            @Min(0) @Max(24) Integer periodMonths,
            LocalDate customFrom,
            LocalDate customTo
    ) {}

    public record DashboardResponse(
            UUID id,
            String name,
            UUID accountId,
            Integer periodMonths,
            LocalDate customFrom,
            LocalDate customTo,
            LocalDateTime createdAt
    ) {}
}
