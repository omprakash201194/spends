package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.DataHealthDto;
import com.omprakashgautam.homelab.spends.repository.CategoryRuleRepository;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DataHealthServiceTest {

    @Mock TransactionRepository transactionRepository;
    @Mock CategoryRuleRepository categoryRuleRepository;

    @InjectMocks DataHealthService dataHealthService;

    private static final UUID USER_ID = UUID.randomUUID();

    private void stubDefaults() {
        when(transactionRepository.countByUserId(USER_ID)).thenReturn(100L);
        when(transactionRepository.countUncategorized(USER_ID)).thenReturn(5L);
        when(transactionRepository.countByCategoryName(USER_ID, "Miscellaneous")).thenReturn(20L);
        when(transactionRepository.earliestDate(USER_ID)).thenReturn(LocalDate.of(2024, 1, 1));
        when(transactionRepository.latestTransactionDate(USER_ID)).thenReturn(LocalDate.of(2025, 3, 31));
        when(transactionRepository.countDistinctBankAccounts(USER_ID)).thenReturn(2L);
        when(categoryRuleRepository.countByUserId(USER_ID)).thenReturn(8L);
        when(categoryRuleRepository.countGlobal()).thenReturn(52L);
        when(transactionRepository.findNearDuplicates(USER_ID)).thenReturn(List.of());
    }

    @Test
    void getReport_returnsCorrectStats() {
        stubDefaults();

        DataHealthDto.Report report = dataHealthService.getReport(USER_ID);

        assertThat(report.transactions().total()).isEqualTo(100L);
        assertThat(report.transactions().uncategorized()).isEqualTo(5L);
        assertThat(report.transactions().miscellaneous()).isEqualTo(20L);
        assertThat(report.transactions().earliestDate()).isEqualTo("2024-01-01");
        assertThat(report.transactions().latestDate()).isEqualTo("2025-03-31");
        assertThat(report.transactions().accountCount()).isEqualTo(2L);
        assertThat(report.rules().userRules()).isEqualTo(8L);
        assertThat(report.rules().globalRules()).isEqualTo(52L);
        assertThat(report.nearDuplicates()).isEmpty();
    }

    @Test
    void getReport_returnsNearDuplicatesWhenPresent() {
        stubDefaults();
        Object[] dupRow = new Object[]{
                "XXXX1234", "ICICI",
                LocalDate.of(2025, 3, 15),
                new BigDecimal("5000"),
                2L
        };
        when(transactionRepository.findNearDuplicates(USER_ID)).thenReturn(List.<Object[]>of(dupRow));

        DataHealthDto.Report report = dataHealthService.getReport(USER_ID);

        assertThat(report.nearDuplicates()).hasSize(1);
        DataHealthDto.NearDuplicate dup = report.nearDuplicates().get(0);
        assertThat(dup.accountLabel()).isEqualTo("XXXX1234 · ICICI");
        assertThat(dup.date()).isEqualTo("2025-03-15");
        assertThat(dup.amount()).isEqualByComparingTo("5000");
        assertThat(dup.count()).isEqualTo(2L);
    }

    @Test
    void getReport_handlesNoTransactions() {
        stubDefaults();
        when(transactionRepository.countByUserId(USER_ID)).thenReturn(0L);
        when(transactionRepository.countUncategorized(USER_ID)).thenReturn(0L);
        when(transactionRepository.countByCategoryName(USER_ID, "Miscellaneous")).thenReturn(0L);
        when(transactionRepository.earliestDate(USER_ID)).thenReturn(null);
        when(transactionRepository.latestTransactionDate(USER_ID)).thenReturn(null);
        when(transactionRepository.countDistinctBankAccounts(USER_ID)).thenReturn(0L);
        when(categoryRuleRepository.countByUserId(USER_ID)).thenReturn(0L);

        DataHealthDto.Report report = dataHealthService.getReport(USER_ID);

        assertThat(report.transactions().total()).isEqualTo(0L);
        assertThat(report.transactions().earliestDate()).isNull();
        assertThat(report.transactions().latestDate()).isNull();
        assertThat(report.nearDuplicates()).isEmpty();
    }
}
