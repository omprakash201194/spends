package com.omprakashgautam.homelab.spends.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public class HouseholdDto {

    public record MemberStat(
            UUID userId,
            String displayName,
            String role,            // "ADMIN" | "MEMBER"
            BigDecimal totalSpent,
            BigDecimal totalIncome,
            long transactionCount,
            String topCategory,     // null if no spending this month
            String topCategoryColor
    ) {}

    public record Summary(
            UUID householdId,
            String householdName,
            String inviteCode,
            String month,           // "April 2025"
            BigDecimal totalSpent,
            BigDecimal totalIncome,
            List<MemberStat> members
    ) {}
}
