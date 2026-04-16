package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.RecurringDto;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecurringServiceTest {

    @Mock
    TransactionRepository transactionRepository;

    @InjectMocks
    RecurringService service;

    private static final UUID USER_ID = UUID.randomUUID();

    /** Helper: builds a single merchant-month row in the same layout as the JPQL query returns. */
    private static Object[] row(String merchant, String cat, String color,
                                String yearMonth, double withdrawal, double deposit, long count) {
        return new Object[]{
                merchant, cat, color, yearMonth,
                BigDecimal.valueOf(withdrawal), BigDecimal.valueOf(deposit), count
        };
    }

    @Test
    void detectsMonthlySubscription() {
        when(transactionRepository.latestTransactionDate(USER_ID))
                .thenReturn(LocalDate.of(2025, 4, 15));
        when(transactionRepository.merchantMonthlyActivity(eq(USER_ID), any()))
                .thenReturn(List.of(
                        row("Netflix", "Entertainment", "#ef4444", "2025-02", 649.0, 0, 1),
                        row("Netflix", "Entertainment", "#ef4444", "2025-03", 649.0, 0, 1),
                        row("Netflix", "Entertainment", "#ef4444", "2025-04", 649.0, 0, 1)
                ));

        RecurringDto.RecurringSummary result = service.getPatterns(USER_ID);

        assertThat(result.patterns()).hasSize(1);
        RecurringDto.RecurringPattern p = result.patterns().get(0);
        assertThat(p.merchantName()).isEqualTo("Netflix");
        assertThat(p.frequency()).isEqualTo(RecurringDto.Frequency.MONTHLY);
        assertThat(p.averageAmount()).isEqualByComparingTo("649.00");
        assertThat(p.occurrences()).isEqualTo(3);
        assertThat(p.activeThisMonth()).isTrue();
        assertThat(p.lastMonth()).isEqualTo("2025-04");
        assertThat(p.nextExpected()).isEqualTo("2025-05");
    }

    @Test
    void detectsMonthlyDeposit_salary() {
        when(transactionRepository.latestTransactionDate(USER_ID))
                .thenReturn(LocalDate.of(2025, 4, 15));
        when(transactionRepository.merchantMonthlyActivity(eq(USER_ID), any()))
                .thenReturn(List.of(
                        row("NEFT SALARY", "Income", "#22c55e", "2025-02", 0, 50000.0, 1),
                        row("NEFT SALARY", "Income", "#22c55e", "2025-03", 0, 50000.0, 1),
                        row("NEFT SALARY", "Income", "#22c55e", "2025-04", 0, 50000.0, 1)
                ));

        RecurringDto.RecurringSummary result = service.getPatterns(USER_ID);

        assertThat(result.patterns()).hasSize(1);
        assertThat(result.patterns().get(0).merchantName()).isEqualTo("NEFT SALARY");
        assertThat(result.patterns().get(0).averageAmount()).isEqualByComparingTo("50000.00");
    }

    @Test
    void ignoresMerchantWithOnlyTwoOccurrences() {
        when(transactionRepository.latestTransactionDate(USER_ID))
                .thenReturn(LocalDate.of(2025, 4, 15));
        when(transactionRepository.merchantMonthlyActivity(eq(USER_ID), any()))
                .thenReturn(List.of(
                        row("Swiggy", "Food & Dining", "#f97316", "2025-03", 500.0, 0, 3),
                        row("Swiggy", "Food & Dining", "#f97316", "2025-04", 600.0, 0, 4)
                ));

        RecurringDto.RecurringSummary result = service.getPatterns(USER_ID);

        assertThat(result.patterns()).isEmpty();
    }

    @Test
    void ignoresMerchantWithHighAmountVariance() {
        when(transactionRepository.latestTransactionDate(USER_ID))
                .thenReturn(LocalDate.of(2025, 4, 15));
        when(transactionRepository.merchantMonthlyActivity(eq(USER_ID), any()))
                .thenReturn(List.of(
                        row("Netflix", "Entertainment", "#ef4444", "2025-02", 649.0, 0, 1),
                        row("Netflix", "Entertainment", "#ef4444", "2025-03", 1299.0, 0, 1),
                        row("Netflix", "Entertainment", "#ef4444", "2025-04", 1299.0, 0, 1)
                ));

        RecurringDto.RecurringSummary result = service.getPatterns(USER_ID);

        assertThat(result.patterns()).isEmpty();
    }

    @Test
    void ignoresMerchantWithMixedDebitCredit() {
        when(transactionRepository.latestTransactionDate(USER_ID))
                .thenReturn(LocalDate.of(2025, 4, 15));
        when(transactionRepository.merchantMonthlyActivity(eq(USER_ID), any()))
                .thenReturn(List.of(
                        row("ICICI Bank", "Financial", "#3b82f6", "2025-02", 1000.0, 0, 1),
                        row("ICICI Bank", "Financial", "#3b82f6", "2025-03", 0, 2000.0, 1),
                        row("ICICI Bank", "Financial", "#3b82f6", "2025-04", 1000.0, 0, 1)
                ));

        RecurringDto.RecurringSummary result = service.getPatterns(USER_ID);

        assertThat(result.patterns()).isEmpty();
    }

    @Test
    void sortsByAverageAmountDescending() {
        when(transactionRepository.latestTransactionDate(USER_ID))
                .thenReturn(LocalDate.of(2025, 4, 15));
        when(transactionRepository.merchantMonthlyActivity(eq(USER_ID), any()))
                .thenReturn(List.of(
                        row("Netflix", "Entertainment", "#ef4444", "2025-02", 649.0, 0, 1),
                        row("Netflix", "Entertainment", "#ef4444", "2025-03", 649.0, 0, 1),
                        row("Netflix", "Entertainment", "#ef4444", "2025-04", 649.0, 0, 1),
                        row("RENT", "Rent & Housing", "#8b5cf6", "2025-02", 25000.0, 0, 1),
                        row("RENT", "Rent & Housing", "#8b5cf6", "2025-03", 25000.0, 0, 1),
                        row("RENT", "Rent & Housing", "#8b5cf6", "2025-04", 25000.0, 0, 1)
                ));

        RecurringDto.RecurringSummary result = service.getPatterns(USER_ID);

        assertThat(result.patterns()).hasSize(2);
        assertThat(result.patterns().get(0).merchantName()).isEqualTo("RENT");
        assertThat(result.patterns().get(1).merchantName()).isEqualTo("Netflix");
    }

    @Test
    void activeThisMonthFalseWhenNotSeenInAnchorMonth() {
        when(transactionRepository.latestTransactionDate(USER_ID))
                .thenReturn(LocalDate.of(2025, 4, 15));
        when(transactionRepository.merchantMonthlyActivity(eq(USER_ID), any()))
                .thenReturn(List.of(
                        row("Netflix", "Entertainment", "#ef4444", "2025-01", 649.0, 0, 1),
                        row("Netflix", "Entertainment", "#ef4444", "2025-02", 649.0, 0, 1),
                        row("Netflix", "Entertainment", "#ef4444", "2025-03", 649.0, 0, 1)
                ));

        RecurringDto.RecurringSummary result = service.getPatterns(USER_ID);

        assertThat(result.patterns()).hasSize(1);
        assertThat(result.patterns().get(0).activeThisMonth()).isFalse();
        assertThat(result.patterns().get(0).nextExpected()).isEqualTo("2025-04");
    }
}
