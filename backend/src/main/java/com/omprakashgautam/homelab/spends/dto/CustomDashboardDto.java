package com.omprakashgautam.homelab.spends.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDateTime;
import java.util.UUID;

public class CustomDashboardDto {

    public record CreateRequest(@NotBlank String name) {}

    public record RenameRequest(@NotBlank String name) {}

    public record DashboardResponse(UUID id, String name, LocalDateTime createdAt) {}
}
