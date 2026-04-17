package com.omprakashgautam.homelab.spends.dto;

public class InsightDto {
    public enum InsightType { DASHBOARD, BUDGET, TRANSACTIONS, RECURRING }
    public record Response(String insight, String month) {}

    public record RuleSuggestion(
        String pattern,
        String existingCategoryId,
        String existingCategoryName,
        String suggestNewCategoryName,
        String suggestParentCategoryName,
        String suggestColor
    ) {}

    public record AutoCategorizeResponse(java.util.List<RuleSuggestion> suggestions) {}
}
