package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.SavingsGoalDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.SavingsGoalService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/goals")
@RequiredArgsConstructor
public class SavingsGoalController {

    private final SavingsGoalService savingsGoalService;

    @GetMapping
    public ResponseEntity<List<SavingsGoalDto.GoalResponse>> listGoals(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        return ResponseEntity.ok(savingsGoalService.listGoals(principal.getId()));
    }

    @PostMapping
    public ResponseEntity<SavingsGoalDto.GoalResponse> createGoal(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestBody SavingsGoalDto.CreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(savingsGoalService.createGoal(principal.getId(), request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteGoal(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id) {
        savingsGoalService.deleteGoal(principal.getId(), id);
        return ResponseEntity.noContent().build();
    }
}
