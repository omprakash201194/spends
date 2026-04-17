package com.omprakashgautam.homelab.spends.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public class MerchantAliasDto {

    public record Response(UUID id, String rawPattern, String displayName) {}

    public record SaveRequest(
        @NotBlank String rawPattern,
        @NotBlank String displayName
    ) {}
}
