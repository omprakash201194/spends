package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.model.Transaction;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSender;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock UserRepository userRepository;
    @Mock TransactionRepository transactionRepository;
    @Mock JavaMailSender mailSender;
    @InjectMocks NotificationService notificationService;

    @Test
    void detectAnomalies_returnsLargeWithdrawals() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).notificationEmail("test@test.com").build();

        Transaction bigTx = Transaction.builder()
            .id(UUID.randomUUID())
            .withdrawalAmount(new BigDecimal("50000"))
            .depositAmount(BigDecimal.ZERO)
            .rawRemarks("Big spend")
            .reviewed(false)
            .build();

        when(transactionRepository.findLargeWithdrawalsInLast24Hours(eq(userId), any(LocalDate.class), any(BigDecimal.class)))
            .thenReturn(List.of(bigTx));

        List<NotificationService.AnomalyEntry> anomalies = notificationService.detectAnomalies(user);

        assertThat(anomalies).hasSize(1);
        assertThat(anomalies.get(0).amount()).isEqualByComparingTo("50000");
    }

    @Test
    void detectAnomalies_returnsEmptyWhenNoLargeTransactions() {
        User user = User.builder().id(UUID.randomUUID()).notificationEmail("test@test.com").build();
        when(transactionRepository.findLargeWithdrawalsInLast24Hours(any(), any(), any()))
            .thenReturn(List.of());

        List<NotificationService.AnomalyEntry> anomalies = notificationService.detectAnomalies(user);

        assertThat(anomalies).isEmpty();
    }
}
