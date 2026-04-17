package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.DashboardDto;
import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.Household;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock TransactionRepository transactionRepository;
    @Mock CategoryRepository categoryRepository;
    @Mock UserRepository userRepository;
    @InjectMocks DashboardService dashboardService;

    private static final UUID USER_ID = UUID.randomUUID();

    private void stubSharedQueries() {
        Household hh = Household.builder().id(UUID.randomUUID()).name("H").inviteCode("X").maxCategoryDepth(5).build();
        User user = User.builder().id(USER_ID).household(hh).build();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(categoryRepository.findBySystemTrueOrHouseholdId(any())).thenReturn(List.of());
        when(transactionRepository.categoryBreakdown(any(), any(), any())).thenReturn(List.of());
        when(transactionRepository.monthlyTrend(any(), any())).thenReturn(List.of());
        when(transactionRepository.topMerchants(any(), any(), any())).thenReturn(List.of());
    }

    @Test
    void getSummary_prevComparisonFieldsMatchExpectedAggregates() {
        LocalDate anchor = LocalDate.of(2025, 4, 15);
        when(transactionRepository.latestTransactionDate(USER_ID)).thenReturn(anchor);
        stubSharedQueries();

        when(transactionRepository.sumWithdrawals(USER_ID, LocalDate.of(2025, 4, 1), LocalDate.of(2025, 4, 30))).thenReturn(new BigDecimal("10000"));
        when(transactionRepository.sumDeposits(USER_ID,    LocalDate.of(2025, 4, 1), LocalDate.of(2025, 4, 30))).thenReturn(new BigDecimal("50000"));
        when(transactionRepository.countInPeriod(USER_ID,  LocalDate.of(2025, 4, 1), LocalDate.of(2025, 4, 30))).thenReturn(20L);

        when(transactionRepository.sumWithdrawals(USER_ID, LocalDate.of(2025, 3, 1), LocalDate.of(2025, 3, 31))).thenReturn(new BigDecimal("8000"));
        when(transactionRepository.sumDeposits(USER_ID,    LocalDate.of(2025, 3, 1), LocalDate.of(2025, 3, 31))).thenReturn(new BigDecimal("45000"));
        when(transactionRepository.countInPeriod(USER_ID,  LocalDate.of(2025, 3, 1), LocalDate.of(2025, 3, 31))).thenReturn(15L);

        when(transactionRepository.sumWithdrawals(USER_ID, LocalDate.of(2024, 4, 1), LocalDate.of(2024, 4, 30))).thenReturn(new BigDecimal("9000"));
        when(transactionRepository.sumDeposits(USER_ID,    LocalDate.of(2024, 4, 1), LocalDate.of(2024, 4, 30))).thenReturn(new BigDecimal("48000"));
        when(transactionRepository.countInPeriod(USER_ID,  LocalDate.of(2024, 4, 1), LocalDate.of(2024, 4, 30))).thenReturn(18L);

        DashboardDto.Summary summary = dashboardService.getSummary(USER_ID);

        // Previous month assertions (March 2025)
        assertThat(summary.prevMonth().spent()).isEqualByComparingTo("8000");
        assertThat(summary.prevMonth().income()).isEqualByComparingTo("45000");
        assertThat(summary.prevMonth().transactionCount()).isEqualTo(15L);

        // Previous year assertions (April 2024)
        assertThat(summary.prevYear().spent()).isEqualByComparingTo("9000");
        assertThat(summary.prevYear().income()).isEqualByComparingTo("48000");
        assertThat(summary.prevYear().transactionCount()).isEqualTo(18L);
    }

    @Test
    void getSummary_prevMonthIsZeroWhenNoPreviousData() {
        LocalDate anchor = LocalDate.of(2025, 4, 15);
        when(transactionRepository.latestTransactionDate(USER_ID)).thenReturn(anchor);
        stubSharedQueries();
        when(transactionRepository.sumWithdrawals(any(), any(), any())).thenReturn(BigDecimal.ZERO);
        when(transactionRepository.sumDeposits(any(), any(), any())).thenReturn(BigDecimal.ZERO);
        when(transactionRepository.countInPeriod(any(), any(), any())).thenReturn(0L);

        DashboardDto.Summary summary = dashboardService.getSummary(USER_ID);

        assertThat(summary.prevMonth().spent()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(summary.prevMonth().transactionCount()).isEqualTo(0L);
        assertThat(summary.prevYear().spent()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(summary.prevYear().income()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(summary.prevYear().transactionCount()).isEqualTo(0L);
    }

    @Test
    void getSummary_rollsUpChildCategorySpending() {
        UUID householdId = UUID.randomUUID();
        UUID foodId   = UUID.randomUUID();
        UUID swiggyId = UUID.randomUUID();
        Category food   = Category.builder().id(foodId).name("Food").color("#f00").system(true).build();
        Category swiggy = Category.builder().id(swiggyId).name("Swiggy").system(false).parent(food).color("#0f0").build();
        Household hh = Household.builder().id(householdId).name("H").inviteCode("X").maxCategoryDepth(5).build();
        User user = User.builder().id(USER_ID).household(hh).build();

        LocalDate anchor = LocalDate.of(2025, 10, 31);
        when(transactionRepository.latestTransactionDate(USER_ID)).thenReturn(anchor);
        when(transactionRepository.sumWithdrawals(any(), any(), any())).thenReturn(new BigDecimal("1500"));
        when(transactionRepository.sumDeposits(any(), any(), any())).thenReturn(BigDecimal.ZERO);
        when(transactionRepository.countInPeriod(any(), any(), any())).thenReturn(5L);
        Object[] swiggyRow = {swiggyId, "Swiggy", "#0f0", new BigDecimal("1500")};
        List<Object[]> breakdown = new java.util.ArrayList<>();
        breakdown.add(swiggyRow);
        when(transactionRepository.categoryBreakdown(any(), any(), any())).thenReturn(breakdown);
        when(transactionRepository.monthlyTrend(any(), any())).thenReturn(List.of());
        when(transactionRepository.topMerchants(any(), any(), any())).thenReturn(List.of());
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(categoryRepository.findBySystemTrueOrHouseholdId(householdId)).thenReturn(List.of(food, swiggy));

        DashboardDto.Summary summary = dashboardService.getSummary(USER_ID);

        assertThat(summary.categoryBreakdown()).hasSize(1);
        assertThat(summary.categoryBreakdown().get(0).name()).isEqualTo("Food");
        assertThat(summary.categoryBreakdown().get(0).amount()).isEqualByComparingTo("1500");
    }
}
