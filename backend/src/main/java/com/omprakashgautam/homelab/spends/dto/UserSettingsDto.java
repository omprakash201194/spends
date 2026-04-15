package com.omprakashgautam.homelab.spends.dto;

public class UserSettingsDto {
    public record Settings(boolean hasApiKey) {}
    public record ApiKeyRequest(String apiKey) {}
}
