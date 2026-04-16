package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.SavingsGoalDto;
import com.omprakashgautam.homelab.spends.model.SavingsGoal;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.SavingsGoalRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SavingsGoalServiceTest {

    @Mock SavingsGoalRepository goalRepository;
    @Mock TransactionRepository  transactionRepository;
    @Mock UserRepository         userRepository;

    @InjectMocks SavingsGoalService service;

    static final UUID USER_ID = UUID.randomUUID();

    @Test
    void listGoals_computesProgressFromNetSavings() {
        SavingsGoal goal = SavingsGoal.builder()
                .id(UUID.randomUUID())
                .user(User.builder().id(USER_ID).build())
                .name("Emergency Fund")
                .target(new BigDecimal("50000"))
                .startDate(LocalDate.of(2025, 1, 1))
                .targetDate(null)
                .build();
        when(goalRepository.findAllByUserIdOrderByCreatedAtAsc(USER_ID)).thenReturn(List.of(goal));
        when(transactionRepository.sumDeposits(eq(USER_ID), eq(LocalDate.of(2025, 1, 1)), any()))
                .thenReturn(new BigDecimal("30000"));
        when(transactionRepository.sumWithdrawals(eq(USER_ID), eq(LocalDate.of(2025, 1, 1)), any()))
                .thenReturn(new BigDecimal("15000"));

        List<SavingsGoalDto.GoalResponse> result = service.listGoals(USER_ID);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).saved()).isEqualByComparingTo("15000");
        assertThat(result.get(0).percentage()).isEqualTo(30);  // 15000/50000
        assertThat(result.get(0).achieved()).isFalse();
    }

    @Test
    void listGoals_capsPercentageAt100WhenOverTarget() {
        SavingsGoal goal = SavingsGoal.builder()
                .id(UUID.randomUUID())
                .user(User.builder().id(USER_ID).build())
                .name("Vacation")
                .target(new BigDecimal("10000"))
                .startDate(LocalDate.of(2025, 1, 1))
                .targetDate(null)
                .build();
        when(goalRepository.findAllByUserIdOrderByCreatedAtAsc(USER_ID)).thenReturn(List.of(goal));
        when(transactionRepository.sumDeposits(any(), any(), any()))
                .thenReturn(new BigDecimal("25000"));
        when(transactionRepository.sumWithdrawals(any(), any(), any()))
                .thenReturn(new BigDecimal("5000")); // net = 20000 > 10000

        List<SavingsGoalDto.GoalResponse> result = service.listGoals(USER_ID);

        assertThat(result.get(0).percentage()).isEqualTo(100);
        assertThat(result.get(0).achieved()).isTrue();
    }

    @Test
    void listGoals_clampsNegativeNetSavingsToZero() {
        SavingsGoal goal = SavingsGoal.builder()
                .id(UUID.randomUUID())
                .user(User.builder().id(USER_ID).build())
                .name("Laptop Fund")
                .target(new BigDecimal("80000"))
                .startDate(LocalDate.of(2025, 1, 1))
                .targetDate(null)
                .build();
        when(goalRepository.findAllByUserIdOrderByCreatedAtAsc(USER_ID)).thenReturn(List.of(goal));
        when(transactionRepository.sumDeposits(any(), any(), any()))
                .thenReturn(new BigDecimal("10000"));
        when(transactionRepository.sumWithdrawals(any(), any(), any()))
                .thenReturn(new BigDecimal("15000")); // net = -5000

        List<SavingsGoalDto.GoalResponse> result = service.listGoals(USER_ID);

        assertThat(result.get(0).saved()).isEqualByComparingTo("0");
        assertThat(result.get(0).percentage()).isEqualTo(0);
    }

    @Test
    void createGoal_savesEntityAndReturnsResponse() {
        SavingsGoalDto.CreateRequest req = new SavingsGoalDto.CreateRequest(
                "House Down Payment", new BigDecimal("500000"),
                LocalDate.of(2025, 1, 1), LocalDate.of(2026, 12, 31));
        User user = User.builder().id(USER_ID).build();
        when(userRepository.getReferenceById(USER_ID)).thenReturn(user);
        SavingsGoal saved = SavingsGoal.builder()
                .id(UUID.randomUUID())
                .user(user)
                .name(req.name())
                .target(req.target())
                .startDate(req.startDate())
                .targetDate(req.targetDate())
                .build();
        when(goalRepository.save(any())).thenReturn(saved);
        when(transactionRepository.sumDeposits(any(), any(), any())).thenReturn(BigDecimal.ZERO);
        when(transactionRepository.sumWithdrawals(any(), any(), any())).thenReturn(BigDecimal.ZERO);

        SavingsGoalDto.GoalResponse result = service.createGoal(USER_ID, req);

        assertThat(result.name()).isEqualTo("House Down Payment");
        assertThat(result.target()).isEqualByComparingTo("500000");
        assertThat(result.saved()).isEqualByComparingTo("0");
        assertThat(result.achieved()).isFalse();
    }

    @Test
    void deleteGoal_throwsForbiddenIfNotOwner() {
        UUID goalId = UUID.randomUUID();
        SavingsGoal goal = SavingsGoal.builder()
                .id(goalId)
                .user(User.builder().id(UUID.randomUUID()).build()) // different owner
                .name("Not mine")
                .target(BigDecimal.TEN)
                .startDate(LocalDate.now())
                .build();
        when(goalRepository.findById(goalId)).thenReturn(Optional.of(goal));

        assertThatThrownBy(() -> service.deleteGoal(USER_ID, goalId))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.FORBIDDEN));
    }
}
