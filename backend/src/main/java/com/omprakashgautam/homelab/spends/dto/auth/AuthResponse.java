package com.omprakashgautam.homelab.spends.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private String tokenType = "Bearer";
    private UUID userId;
    private String username;
    private String displayName;
    private String role;
    private UUID householdId;
    private String householdName;
}
