package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.TransactionDto;
import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.CategoryRule;
import com.omprakashgautam.homelab.spends.model.Transaction;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
import com.omprakashgautam.homelab.spends.repository.CategoryRuleRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final CategoryRepository categoryRepository;
    private final CategoryRuleRepository categoryRuleRepository;
    private final UserRepository userRepository;

    // ── List with filters ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public TransactionDto.PagedResponse list(
            UUID userId,
            String search,
            UUID categoryId,
            UUID accountId,
            String type,           // DEBIT | CREDIT | ALL
            LocalDate dateFrom,
            LocalDate dateTo,
            int page,
            int size,
            String sortBy,
            String sortDir
    ) {
        Sort sort = buildSort(sortBy, sortDir);
        PageRequest pageable = PageRequest.of(page, size, sort);

        Specification<Transaction> spec = buildSpec(userId, search, categoryId, accountId, type, dateFrom, dateTo);
        Page<Transaction> result = transactionRepository.findAll(spec, pageable);

        List<TransactionDto.Response> content = result.getContent()
                .stream()
                .map(TransactionDto.Response::from)
                .toList();

        return new TransactionDto.PagedResponse(
                content,
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages()
        );
    }

    /**
     * Returns all transactions matching the given filters without pagination.
     * Used by ExportService to generate CSV downloads.
     * Sort: most recent first (valueDate DESC).
     */
    @Transactional(readOnly = true)
    public List<Transaction> listAll(UUID userId, String search, UUID categoryId,
                                     UUID accountId, String type,
                                     LocalDate dateFrom, LocalDate dateTo) {
        Specification<Transaction> spec = buildSpec(userId, search, categoryId, accountId, type, dateFrom, dateTo);
        return transactionRepository.findAll(spec, Sort.by("valueDate").descending());
    }

    private Specification<Transaction> buildSpec(
            UUID userId,
            String search,
            UUID categoryId,
            UUID accountId,
            String type,
            LocalDate dateFrom,
            LocalDate dateTo
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // Only the user's own transactions (via bankAccount → user)
            predicates.add(cb.equal(root.get("bankAccount").get("user").get("id"), userId));

            // Text search across remarks and merchant name
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("rawRemarks")), pattern),
                        cb.like(cb.lower(root.get("merchantName")), pattern)
                ));
            }

            if (categoryId != null) {
                predicates.add(cb.equal(root.get("category").get("id"), categoryId));
            }

            if (accountId != null) {
                predicates.add(cb.equal(root.get("bankAccount").get("id"), accountId));
            }

            if ("DEBIT".equalsIgnoreCase(type)) {
                predicates.add(cb.greaterThan(root.get("withdrawalAmount"), java.math.BigDecimal.ZERO));
            } else if ("CREDIT".equalsIgnoreCase(type)) {
                predicates.add(cb.greaterThan(root.get("depositAmount"), java.math.BigDecimal.ZERO));
            }

            if (dateFrom != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("valueDate"), dateFrom));
            }
            if (dateTo != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("valueDate"), dateTo));
            }

            // Avoid N+1 — eager-fetch category and bankAccount for this query
            if (query != null && query.getResultType().equals(Transaction.class)) {
                root.fetch("category", jakarta.persistence.criteria.JoinType.LEFT);
                root.fetch("bankAccount");
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Sort buildSort(String sortBy, String sortDir) {
        boolean desc = "desc".equalsIgnoreCase(sortDir);
        String field = switch (sortBy == null ? "" : sortBy) {
            case "merchant"    -> "merchantName";
            case "withdrawal"  -> "withdrawalAmount";
            case "deposit"     -> "depositAmount";
            case "balance"     -> "balance";
            case "txDate"      -> "transactionDate";
            default            -> "valueDate";
        };
        return desc ? Sort.by(field).descending() : Sort.by(field).ascending();
    }

    // ── Category update ──────────────────────────────────────────────────────

    @Transactional
    public TransactionDto.Response updateCategory(UUID txId, UUID userId, TransactionDto.CategoryUpdateRequest req) {
        Transaction tx = getOwnedTransaction(txId, userId);

        Category category = categoryRepository.findById(req.categoryId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));

        tx.setCategory(category);
        transactionRepository.save(tx);

        if (req.createRule()) {
            createRuleForTransaction(tx, userId, category, req.pattern());
        }

        return TransactionDto.Response.from(tx);
    }

    private void createRuleForTransaction(Transaction tx, UUID userId, Category category, String customPattern) {
        String derivedPattern = derivePattern(tx, customPattern);
        if (derivedPattern == null || derivedPattern.isBlank() || derivedPattern.length() < 3) return;

        User user = userRepository.getReferenceById(userId);
        // Check if an equivalent rule already exists for this user
        boolean exists = categoryRuleRepository.findByUserIdOrderByPriorityDesc(userId)
                .stream()
                .anyMatch(r -> r.getPattern().equalsIgnoreCase(derivedPattern));

        if (!exists) {
            CategoryRule rule = CategoryRule.builder()
                    .user(user)
                    .pattern(derivedPattern)
                    .category(category)
                    .priority(50)
                    .global(false)
                    .build();
            categoryRuleRepository.save(rule);
        }
    }

    private String derivePattern(Transaction tx, String customPattern) {
        if (customPattern != null && !customPattern.isBlank()) {
            return customPattern.toLowerCase();
        }
        if (tx.getMerchantName() != null && !tx.getMerchantName().isBlank()) {
            return tx.getMerchantName().toLowerCase();
        }
        if (tx.getRawRemarks() != null) {
            java.util.regex.Matcher m = java.util.regex.Pattern
                    .compile("UPI/([^/@]+)", java.util.regex.Pattern.CASE_INSENSITIVE)
                    .matcher(tx.getRawRemarks());
            if (m.find()) {
                return m.group(1).replaceAll("\\d+$", "").toLowerCase();
            }
        }
        return null;
    }

    // ── Note update ──────────────────────────────────────────────────────────

    @Transactional
    public TransactionDto.Response updateNote(UUID id, UUID userId, String note) {
        Transaction tx = getOwnedTransaction(id, userId);
        tx.setNote(note);
        return TransactionDto.Response.from(transactionRepository.save(tx));
    }

    // ── Reviewed toggle ──────────────────────────────────────────────────────

    @Transactional
    public TransactionDto.Response toggleReviewed(UUID txId, UUID userId) {
        Transaction tx = getOwnedTransaction(txId, userId);
        tx.setReviewed(!tx.isReviewed());
        return TransactionDto.Response.from(transactionRepository.save(tx));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Transaction getOwnedTransaction(UUID txId, UUID userId) {
        Transaction tx = transactionRepository.findById(txId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transaction not found"));
        if (!tx.getBankAccount().getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        return tx;
    }
}
