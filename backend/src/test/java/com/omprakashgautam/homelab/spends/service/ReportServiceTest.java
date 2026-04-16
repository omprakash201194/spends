package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.ReportDto;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportServiceTest {

    @Mock
    TransactionRepository transactionRepository;

    @InjectMocks
    ReportService reportService;

    private static final UUID USER_ID = UUID.randomUUID();

    @Test
    void monthlySummary_alwaysReturns12Months() {
        when(transactionRepository.monthlyTrend(any(), any())).thenReturn(List.of());
        when(transactionRepository.categorySpendByMonth(any(), any(), any())).thenReturn(List.of());

        ReportDto.YearSummary summary = reportService.getMonthlySummary(USER_ID, 2025);

        assertThat(summary.months()).hasSize(12);
    }

    @Test
    void monthlySummary_zeroFillsMissingMonths() {
        // Only January and March have data; Feb and the rest should be zero
        List<Object[]> trend = new ArrayList<>();
        trend.add(new Object[]{"2025-01", new BigDecimal("5000"), new BigDecimal("45000")});
        trend.add(new Object[]{"2025-03", new BigDecimal("3000"), new BigDecimal("0")});
        when(transactionRepository.monthlyTrend(any(), any())).thenReturn(trend);
        when(transactionRepository.categorySpendByMonth(any(), any(), any())).thenReturn(List.of());

        ReportDto.YearSummary summary = reportService.getMonthlySummary(USER_ID, 2025);

        assertThat(summary.months().get(0).totalSpent()).isEqualByComparingTo("5000");
        assertThat(summary.months().get(1).totalSpent()).isEqualByComparingTo("0"); // Feb: zero
        assertThat(summary.months().get(2).totalSpent()).isEqualByComparingTo("3000");
    }

    @Test
    void monthlySummary_grandTotalsSum() {
        List<Object[]> trend = new ArrayList<>();
        trend.add(new Object[]{"2025-01", new BigDecimal("5000"), new BigDecimal("45000")});
        trend.add(new Object[]{"2025-06", new BigDecimal("3000"), new BigDecimal("0")});
        when(transactionRepository.monthlyTrend(any(), any())).thenReturn(trend);
        when(transactionRepository.categorySpendByMonth(any(), any(), any())).thenReturn(List.of());

        ReportDto.YearSummary summary = reportService.getMonthlySummary(USER_ID, 2025);

        assertThat(summary.grandTotalSpent()).isEqualByComparingTo("8000");
        assertThat(summary.grandTotalIncome()).isEqualByComparingTo("45000");
    }

    @Test
    void monthlySummary_filtersOutOtherYears() {
        // A row from 2024 must NOT appear in a 2025 report
        List<Object[]> trend = new ArrayList<>();
        trend.add(new Object[]{"2025-01", new BigDecimal("5000"), new BigDecimal("0")});
        trend.add(new Object[]{"2024-12", new BigDecimal("9999"), new BigDecimal("0")});
        when(transactionRepository.monthlyTrend(any(), any())).thenReturn(trend);
        when(transactionRepository.categorySpendByMonth(any(), any(), any())).thenReturn(List.of());

        ReportDto.YearSummary summary = reportService.getMonthlySummary(USER_ID, 2025);

        assertThat(summary.grandTotalSpent()).isEqualByComparingTo("5000");
    }

    @Test
    void monthlySummary_categoryRowsAreAttachedToCorrectMonth() {
        List<Object[]> trend = new ArrayList<>();
        trend.add(new Object[]{"2025-04", new BigDecimal("8000"), new BigDecimal("0")});

        List<Object[]> cats = new ArrayList<>();
        cats.add(new Object[]{"2025-04", "Food & Dining", "#ef4444", new BigDecimal("3500")});
        cats.add(new Object[]{"2025-04", "Transport",     "#3b82f6", new BigDecimal("1200")});
        when(transactionRepository.monthlyTrend(any(), any())).thenReturn(trend);
        when(transactionRepository.categorySpendByMonth(any(), any(), any())).thenReturn(cats);

        ReportDto.YearSummary summary = reportService.getMonthlySummary(USER_ID, 2025);

        // April is month index 3 (0-based)
        ReportDto.MonthRow april = summary.months().get(3);
        assertThat(april.categories()).hasSize(2);
        assertThat(april.categories().get(0).category()).isEqualTo("Food & Dining");
        assertThat(april.categories().get(0).amount()).isEqualByComparingTo("3500");
    }

    @Test
    void getAvailableYears_returnsCurrentYearWhenNoData() {
        when(transactionRepository.availableYears(any())).thenReturn(List.of());

        List<Integer> years = reportService.getAvailableYears(USER_ID);

        assertThat(years).containsExactly(LocalDate.now().getYear());
    }

    @Test
    void getAvailableYears_returnsDbResultsWhenPresent() {
        when(transactionRepository.availableYears(any())).thenReturn(List.of(2025, 2024, 2023));

        List<Integer> years = reportService.getAvailableYears(USER_ID);

        assertThat(years).containsExactly(2025, 2024, 2023);
    }
}
