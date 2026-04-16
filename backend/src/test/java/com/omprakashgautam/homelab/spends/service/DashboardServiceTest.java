package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.DashboardDto;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock TransactionRepository transactionRepository;
    @InjectMocks DashboardService dashboardService;

    private static final UUID USER_ID = UUID.randomUUID();

    private void stubSharedQueries() {
        when(transactionRepository.categoryBreakdown(any(), any(), any())).thenReturn(List.of());
        when(transactionRepository.monthlyTrend(any(), any())).thenReturn(List.of());
        when(transactionRepository.topMerchants(any(), any(), any())).thenReturn(List.of());
    }

    @Test
    void getSummary_prevMonthFieldsMatchPreviousMonthAggregates() {
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

        assertThat(summary.prevMonth().spent()).isEqualByComparingTo("8000");
        assertThat(summary.prevMonth().income()).isEqualByComparingTo("45000");
        assertThat(summary.prevMonth().transactionCount()).isEqualTo(15L);
    }

    @Test
    void getSummary_prevYearFieldsMatchSameMonthLastYear() {
        LocalDate anchor = LocalDate.of(2025, 4, 15);
        when(transactionRepository.latestTransactionDate(USER_ID)).thenReturn(anchor);
        stubSharedQueries();

        when(transactionRepository.sumWithdrawals(USER_ID, LocalDate.of(2025, 4, 1), LocalDate.of(2025, 4, 30))).thenReturn(new BigDecimal("10000"));
        when(transactionRepository.sumDeposits(USER_ID,    LocalDate.of(2025, 4, 1), LocalDate.of(2025, 4, 30))).thenReturn(new BigDecimal("50000"));
        when(transactionRepository.countInPeriod(USER_ID,  LocalDate.of(2025, 4, 1), LocalDate.of(2025, 4, 30))).thenReturn(20L);

        when(transactionRepository.sumWithdrawals(USER_ID, LocalDate.of(2025, 3, 1), LocalDate.of(2025, 3, 31))).thenReturn(BigDecimal.ZERO);
        when(transactionRepository.sumDeposits(USER_ID,    LocalDate.of(2025, 3, 1), LocalDate.of(2025, 3, 31))).thenReturn(BigDecimal.ZERO);
        when(transactionRepository.countInPeriod(USER_ID,  LocalDate.of(2025, 3, 1), LocalDate.of(2025, 3, 31))).thenReturn(0L);

        when(transactionRepository.sumWithdrawals(USER_ID, LocalDate.of(2024, 4, 1), LocalDate.of(2024, 4, 30))).thenReturn(new BigDecimal("9000"));
        when(transactionRepository.sumDeposits(USER_ID,    LocalDate.of(2024, 4, 1), LocalDate.of(2024, 4, 30))).thenReturn(new BigDecimal("48000"));
        when(transactionRepository.countInPeriod(USER_ID,  LocalDate.of(2024, 4, 1), LocalDate.of(2024, 4, 30))).thenReturn(18L);

        DashboardDto.Summary summary = dashboardService.getSummary(USER_ID);

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
    }
}
