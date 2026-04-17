package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.BudgetDto;
import com.omprakashgautam.homelab.spends.model.Budget;
import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.repository.BudgetRepository;
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BudgetServiceTest {

    @Mock TransactionRepository transactionRepository;
    @Mock BudgetRepository      budgetRepository;
    @Mock CategoryRepository    categoryRepository;
    @Mock UserRepository        userRepository;
    @InjectMocks BudgetService  budgetService;

    private static final UUID USER_ID     = UUID.randomUUID();
    private static final UUID CATEGORY_ID = UUID.randomUUID();
    private static final UUID BUDGET_ID   = UUID.randomUUID();

    // Anchor: April 2025 — previous month is March 2025
    private static final LocalDate ANCHOR   = LocalDate.of(2025, 4, 15);
    private static final LocalDate APR_FROM = LocalDate.of(2025, 4, 1);
    private static final LocalDate APR_TO   = LocalDate.of(2025, 4, 30);
    private static final LocalDate MAR_FROM = LocalDate.of(2025, 3, 1);
    private static final LocalDate MAR_TO   = LocalDate.of(2025, 3, 31);

    private Category foodCategory;

    @BeforeEach
    void setUp() {
        foodCategory = new Category();
        foodCategory.setId(CATEGORY_ID);
        foodCategory.setName("Food & Dining");
        foodCategory.setColor("#f59e0b");

        when(transactionRepository.latestTransactionDate(USER_ID)).thenReturn(ANCHOR);
        when(categoryRepository.findAll()).thenReturn(List.of(foodCategory));
        // Default: no spending this month, no spending prev month
        when(transactionRepository.categoryBreakdown(eq(USER_ID), eq(APR_FROM), eq(APR_TO)))
                .thenReturn(List.of());
    }

    @Test
    void getMonthSummary_withRollover_addsUnspentFromPreviousMonth() {
        // Budget ₹1000 with rollover=true; prev month spent ₹600 → unspent ₹400
        // Expected effective limit = 1000 + 400 = 1400
        Budget budget = new Budget();
        budget.setId(BUDGET_ID);
        budget.setCategory(foodCategory);
        budget.setAmount(new BigDecimal("1000"));
        budget.setRollover(true);

        when(budgetRepository.findByUserIdAndYearAndMonth(USER_ID, 2025, 4))
                .thenReturn(List.of(budget));
        when(transactionRepository.sumWithdrawalsForCategory(
                eq(USER_ID), eq("Food & Dining"), eq(MAR_FROM), eq(MAR_TO)))
                .thenReturn(new BigDecimal("600"));

        BudgetDto.MonthSummary summary = budgetService.getMonthSummary(USER_ID);

        BudgetDto.CategoryBudget food = summary.categories().get(0);
        assertThat(food.limit()).isEqualByComparingTo("1000");
        assertThat(food.effectiveLimit()).isEqualByComparingTo("1400");
        assertThat(food.rollover()).isTrue();
    }

    @Test
    void getMonthSummary_withRollover_doesNotGoNegativeWhenOverspentPrevMonth() {
        // Budget ₹1000, prev month spent ₹1200 → unspent = max(0, 1000-1200) = 0
        // Effective limit stays at 1000
        Budget budget = new Budget();
        budget.setId(BUDGET_ID);
        budget.setCategory(foodCategory);
        budget.setAmount(new BigDecimal("1000"));
        budget.setRollover(true);

        when(budgetRepository.findByUserIdAndYearAndMonth(USER_ID, 2025, 4))
                .thenReturn(List.of(budget));
        when(transactionRepository.sumWithdrawalsForCategory(
                eq(USER_ID), eq("Food & Dining"), eq(MAR_FROM), eq(MAR_TO)))
                .thenReturn(new BigDecimal("1200"));

        BudgetDto.MonthSummary summary = budgetService.getMonthSummary(USER_ID);

        BudgetDto.CategoryBudget food = summary.categories().get(0);
        assertThat(food.limit()).isEqualByComparingTo("1000");
        assertThat(food.effectiveLimit()).isEqualByComparingTo("1000");
        assertThat(food.rollover()).isTrue();
    }

    @Test
    void getMonthSummary_withoutRollover_effectiveLimitEqualsLimit() {
        // rollover=false — effective limit must equal the set limit, no prev-month query
        Budget budget = new Budget();
        budget.setId(BUDGET_ID);
        budget.setCategory(foodCategory);
        budget.setAmount(new BigDecimal("1000"));
        budget.setRollover(false);

        when(budgetRepository.findByUserIdAndYearAndMonth(USER_ID, 2025, 4))
                .thenReturn(List.of(budget));

        BudgetDto.MonthSummary summary = budgetService.getMonthSummary(USER_ID);

        BudgetDto.CategoryBudget food = summary.categories().get(0);
        assertThat(food.limit()).isEqualByComparingTo("1000");
        assertThat(food.effectiveLimit()).isEqualByComparingTo("1000");
        assertThat(food.rollover()).isFalse();
    }

    @Test
    void getMonthSummary_noBudget_effectiveLimitIsNull() {
        when(budgetRepository.findByUserIdAndYearAndMonth(USER_ID, 2025, 4))
                .thenReturn(List.of());

        BudgetDto.MonthSummary summary = budgetService.getMonthSummary(USER_ID);

        BudgetDto.CategoryBudget food = summary.categories().get(0);
        assertThat(food.limit()).isNull();
        assertThat(food.effectiveLimit()).isNull();
        assertThat(food.rollover()).isFalse();
    }
}
