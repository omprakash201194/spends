package com.omprakashgautam.homelab.spends.dto;

import com.omprakashgautam.homelab.spends.model.Transaction;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class TransactionDto {

    public record CategoryResponse(UUID id, String name, String icon, String color, UUID parentId) {}

    public record AccountSummary(UUID id, String bankName, String accountNumberMasked) {}

    public record Response(
            UUID id,
            AccountSummary account,
            LocalDate valueDate,
            LocalDate transactionDate,
            String rawRemarks,
            String merchantName,
            BigDecimal withdrawalAmount,
            BigDecimal depositAmount,
            BigDecimal balance,
            CategoryResponse category,
            boolean reviewed,
            String note,
            LocalDateTime createdAt
    ) {
        public static Response from(Transaction t) {
            CategoryResponse cat = t.getCategory() == null ? null : new CategoryResponse(
                    t.getCategory().getId(),
                    t.getCategory().getName(),
                    t.getCategory().getIcon(),
                    t.getCategory().getColor(),
                    t.getCategory().getParent() != null ? t.getCategory().getParent().getId() : null
            );
            AccountSummary acct = new AccountSummary(
                    t.getBankAccount().getId(),
                    t.getBankAccount().getBankName(),
                    t.getBankAccount().getAccountNumberMasked()
            );
            return new Response(
                    t.getId(), acct,
                    t.getValueDate(), t.getTransactionDate(),
                    t.getRawRemarks(), t.getMerchantName(),
                    t.getWithdrawalAmount(), t.getDepositAmount(), t.getBalance(),
                    cat, t.isReviewed(), t.getNote(), t.getCreatedAt()
            );
        }
    }

    public record NoteRequest(@NotBlank String note) {}

    public record CategoryUpdateRequest(
            UUID categoryId,        // null = clear category (uncategorize)
            boolean createRule,
            String pattern          // null = auto-derive from merchant name
    ) {}

    public record PagedResponse(
            java.util.List<Response> content,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {}

    public record BulkCategoryRequest(
            @NotEmpty List<UUID> ids,
            @NotNull UUID categoryId
    ) {}

    public record SummaryResponse(
            BigDecimal totalCredit,
            BigDecimal totalDebit,
            BigDecimal net,
            long count
    ) {}
}
