package com.omprakashgautam.homelab.spends.dto;

public class InsightDto {
    public enum InsightType { DASHBOARD, BUDGET, TRANSACTIONS, RECURRING }
    public record Response(String insight, String month) {}
}
