package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

@ExtendWith(MockitoExtension.class)
class DangerZoneServiceTest {

    @Mock TransactionRepository   transactionRepository;
    @Mock ImportBatchRepository   importBatchRepository;
    @Mock CategoryRuleRepository  categoryRuleRepository;
    @Mock BudgetRepository        budgetRepository;
    @Mock ViewRepository          viewRepository;
    @Mock CategoryRepository      categoryRepository;

    @InjectMocks DangerZoneService service;

    @Test
    void deleteAllTransactions_callsBothRepositories() {
        UUID userId = UUID.randomUUID();
        service.deleteAllTransactions(userId);
        verify(transactionRepository).deleteAllByUserId(userId);
        verify(importBatchRepository).deleteAllByUserId(userId);
        verifyNoMoreInteractions(categoryRuleRepository, budgetRepository, viewRepository, categoryRepository);
    }

    @Test
    void deleteAllRules_deletesOnlyUserRules() {
        UUID userId = UUID.randomUUID();
        service.deleteAllRules(userId);
        verify(categoryRuleRepository).deleteAllByUserId(userId);
        verifyNoMoreInteractions(transactionRepository, importBatchRepository, budgetRepository, viewRepository, categoryRepository);
    }

    @Test
    void deleteAllBudgets_deletesOnlyUserBudgets() {
        UUID userId = UUID.randomUUID();
        service.deleteAllBudgets(userId);
        verify(budgetRepository).deleteAllByUserId(userId);
        verifyNoMoreInteractions(transactionRepository, importBatchRepository, categoryRuleRepository, viewRepository, categoryRepository);
    }

    @Test
    void deleteAllViews_deletesHouseholdViews() {
        UUID householdId = UUID.randomUUID();
        service.deleteAllViews(householdId);
        verify(viewRepository).deleteAllByHouseholdId(householdId);
        verifyNoMoreInteractions(transactionRepository, importBatchRepository, categoryRuleRepository, budgetRepository, categoryRepository);
    }

    @Test
    void deleteAllCustomCategories_deletesNonSystemCategoriesForHousehold() {
        UUID householdId = UUID.randomUUID();
        service.deleteAllCustomCategories(householdId);
        verify(categoryRepository).deleteAllByHouseholdIdAndSystemFalse(householdId);
        verifyNoMoreInteractions(transactionRepository, importBatchRepository, categoryRuleRepository, budgetRepository, viewRepository);
    }
}
