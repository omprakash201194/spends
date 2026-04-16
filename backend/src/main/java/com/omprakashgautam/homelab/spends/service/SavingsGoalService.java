package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.SavingsGoalDto;
import com.omprakashgautam.homelab.spends.model.SavingsGoal;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.SavingsGoalRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SavingsGoalService {

    private final SavingsGoalRepository goalRepository;
    private final TransactionRepository  transactionRepository;
    private final UserRepository         userRepository;

    @Transactional(readOnly = true)
    public List<SavingsGoalDto.GoalResponse> listGoals(UUID userId) {
        return goalRepository.findAllByUserIdOrderByCreatedAtAsc(userId)
                .stream()
                .map(g -> toResponse(g, userId))
                .toList();
    }

    @Transactional
    public SavingsGoalDto.GoalResponse createGoal(UUID userId, SavingsGoalDto.CreateRequest req) {
        User user = userRepository.getReferenceById(userId);
        SavingsGoal goal = SavingsGoal.builder()
                .user(user)
                .name(req.name())
                .target(req.target())
                .startDate(req.startDate())
                .targetDate(req.targetDate())
                .build();
        return toResponse(goalRepository.save(goal), userId);
    }

    @Transactional
    public void deleteGoal(UUID userId, UUID goalId) {
        SavingsGoal goal = goalRepository.findById(goalId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found"));
        if (!goal.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        goalRepository.delete(goal);
    }

    /**
     * Computes progress by summing deposits - withdrawals from the goal's startDate
     * to today (or the targetDate if it has already passed). Net savings is clamped
     * to zero and percentage capped at 100.
     */
    private SavingsGoalDto.GoalResponse toResponse(SavingsGoal goal, UUID userId) {
        LocalDate today   = LocalDate.now();
        LocalDate endDate = (goal.getTargetDate() != null && goal.getTargetDate().isBefore(today))
                ? goal.getTargetDate() : today;

        BigDecimal deposits    = transactionRepository.sumDeposits(userId, goal.getStartDate(), endDate);
        BigDecimal withdrawals = transactionRepository.sumWithdrawals(userId, goal.getStartDate(), endDate);
        BigDecimal saved       = deposits.subtract(withdrawals).max(BigDecimal.ZERO);

        int pct = 0;
        if (goal.getTarget().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal rawPct = saved.multiply(BigDecimal.valueOf(100))
                    .divide(goal.getTarget(), 0, RoundingMode.HALF_UP);
            pct = rawPct.min(BigDecimal.valueOf(100)).intValue();
        }
        boolean achieved = saved.compareTo(goal.getTarget()) >= 0;

        return new SavingsGoalDto.GoalResponse(
                goal.getId(), goal.getName(), goal.getTarget(),
                goal.getStartDate(), goal.getTargetDate(),
                saved, pct, achieved
        );
    }
}
