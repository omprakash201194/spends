package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.NetWorthDto;
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
class NetWorthServiceTest {

    @Mock
    TransactionRepository transactionRepository;

    @InjectMocks
    NetWorthService netWorthService;

    private static final UUID USER_ID = UUID.randomUUID();

    /** Builds a monthly-flow row: [year, month, totalIn, totalOut] */
    private static Object[] row(int year, int month, BigDecimal totalIn, BigDecimal totalOut) {
        return new Object[]{ year, month, totalIn, totalOut };
    }

    @Test
    void getNetWorth_returnsCumulativePoints() {
        when(transactionRepository.monthlyFlow(eq(USER_ID), any(LocalDate.class)))
                .thenReturn(List.<Object[]>of(
                        row(2024, 1, new BigDecimal("1000"), new BigDecimal("600"))
                ));

        NetWorthDto.Response result = netWorthService.getNetWorth(USER_ID, 12);

        assertThat(result.points()).hasSize(1);
        assertThat(result.points().get(0).netFlow()).isEqualByComparingTo("400");
        assertThat(result.points().get(0).cumulativeNet()).isEqualByComparingTo("400");
        assertThat(result.points().get(0).year()).isEqualTo(2024);
        assertThat(result.points().get(0).month()).isEqualTo(1);
    }

    @Test
    void getNetWorth_accumulatesAcrossMonths() {
        when(transactionRepository.monthlyFlow(eq(USER_ID), any(LocalDate.class)))
                .thenReturn(List.of(
                        row(2024, 1, new BigDecimal("1000"), new BigDecimal("600")), // net +400
                        row(2024, 2, new BigDecimal("500"),  new BigDecimal("800"))  // net -300, cumulative +100
                ));

        NetWorthDto.Response result = netWorthService.getNetWorth(USER_ID, 12);

        assertThat(result.points()).hasSize(2);
        assertThat(result.points().get(1).cumulativeNet()).isEqualByComparingTo("100");
    }

    @Test
    void getNetWorth_handlesNullDepositOrWithdrawal() {
        // month with only withdrawals (null deposit)
        when(transactionRepository.monthlyFlow(eq(USER_ID), any(LocalDate.class)))
                .thenReturn(List.<Object[]>of(
                        row(2024, 3, null, new BigDecimal("300"))
                ));

        NetWorthDto.Response result = netWorthService.getNetWorth(USER_ID, 12);

        assertThat(result.points()).hasSize(1);
        assertThat(result.points().get(0).netFlow()).isEqualByComparingTo("-300");
        assertThat(result.points().get(0).cumulativeNet()).isEqualByComparingTo("-300");
    }

    @Test
    void getNetWorth_returnsEmptyForNoData() {
        when(transactionRepository.monthlyFlow(eq(USER_ID), any(LocalDate.class)))
                .thenReturn(List.of());

        NetWorthDto.Response result = netWorthService.getNetWorth(USER_ID, 12);

        assertThat(result.points()).isEmpty();
    }
}
