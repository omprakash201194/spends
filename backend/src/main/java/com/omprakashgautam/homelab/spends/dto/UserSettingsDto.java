package com.omprakashgautam.homelab.spends.dto;

public class UserSettingsDto {
    public record Settings(boolean hasApiKey, String notificationEmail) {}
    public record ApiKeyRequest(String apiKey) {}
    public record NotificationEmailRequest(String notificationEmail) {}
}
