package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class DangerZoneService {

    private final TransactionRepository   transactionRepository;
    private final ImportBatchRepository   importBatchRepository;
    private final CategoryRuleRepository  categoryRuleRepository;
    private final BudgetRepository        budgetRepository;
    private final ViewRepository          viewRepository;
    private final CategoryRepository      categoryRepository;

    /** Deletes all transactions and their import batches for the user. */
    @Transactional
    public void deleteAllTransactions(UUID userId) {
        log.warn("AUDIT: deleteAllTransactions userId={}", userId);
        transactionRepository.deleteAllByUserId(userId);
        importBatchRepository.deleteAllByUserId(userId);
    }

    /** Deletes all user-owned categorization rules. */
    @Transactional
    public void deleteAllRules(UUID userId) {
        log.warn("AUDIT: deleteAllRules userId={}", userId);
        categoryRuleRepository.deleteAllByUserId(userId);
    }

    /** Deletes all budget limits for the user. */
    @Transactional
    public void deleteAllBudgets(UUID userId) {
        log.warn("AUDIT: deleteAllBudgets userId={}", userId);
        budgetRepository.deleteAllByUserId(userId);
    }

    /** Deletes all views (and their transaction links / category budgets via DB cascade) for the household. */
    @Transactional
    public void deleteAllViews(UUID householdId) {
        log.warn("AUDIT: deleteAllViews householdId={}", householdId);
        viewRepository.deleteAllByHouseholdId(householdId);
    }

    /** Deletes all non-system custom categories for the household. */
    @Transactional
    public void deleteAllCustomCategories(UUID householdId) {
        log.warn("AUDIT: deleteAllCustomCategories householdId={}", householdId);
        categoryRepository.deleteAllByHouseholdIdAndSystemFalse(householdId);
    }
}
