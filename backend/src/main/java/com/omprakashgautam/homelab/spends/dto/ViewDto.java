package com.omprakashgautam.homelab.spends.dto;

import com.omprakashgautam.homelab.spends.model.ViewType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class ViewDto {

    /** Inbound: one category budget line in a create request */
    public record CategoryBudgetRequest(
            UUID categoryId,
            BigDecimal expectedAmount
    ) {}

    /** Inbound: create a new view */
    public record CreateRequest(
            String name,
            ViewType type,
            LocalDate startDate,
            LocalDate endDate,
            String description,
            String color,
            BigDecimal totalBudget,
            List<CategoryBudgetRequest> categoryBudgets
    ) {}

    /** Inbound: update view metadata (dates and type are immutable) */
    public record UpdateRequest(
            String name,
            String description,
            String color,
            BigDecimal totalBudget
    ) {}

    /** Outbound: one category row (used in both list response and summary) */
    public record CategoryBudgetItem(
            UUID categoryId,
            String categoryName,
            String categoryColor,
            BigDecimal expectedAmount,   // null if no budget set for this category
            BigDecimal actualAmount      // 0 in list view, computed in summary
    ) {}

    /** Outbound: card in the views list + single-view GET */
    public record ViewResponse(
            UUID id,
            String name,
            ViewType type,
            LocalDate startDate,
            LocalDate endDate,
            String description,
            String color,
            BigDecimal totalBudget,
            BigDecimal totalSpent,
            int transactionCount,
            List<CategoryBudgetItem> categoryBudgets
    ) {}

    /** Outbound: per-member spend in summary */
    public record MemberBreakdown(
            UUID userId,
            String displayName,
            BigDecimal amount,
            long count
    ) {}

    /** Outbound: full summary (Summary tab) */
    public record SummaryResponse(
            UUID viewId,
            String name,
            BigDecimal totalBudget,
            BigDecimal totalSpent,
            long transactionCount,
            List<CategoryBudgetItem> categories,
            List<MemberBreakdown> members
    ) {}

    /** Outbound: one transaction row (List + Board tabs) */
    public record TransactionItem(
            UUID id,
            String merchantName,
            String rawRemarks,
            LocalDate valueDate,
            BigDecimal withdrawalAmount,
            BigDecimal depositAmount,
            String categoryName,
            String categoryColor,
            String memberName
    ) {}

    /** Outbound: paginated transaction list */
    public record TransactionPage(
            List<TransactionItem> content,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {}

    /** Inbound: add one or more transactions to a view */
    public record AddTransactionsRequest(
            List<UUID> transactionIds
    ) {}
}
