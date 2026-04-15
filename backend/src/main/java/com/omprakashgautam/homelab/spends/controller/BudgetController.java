package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.BudgetDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.BudgetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/budgets")
@RequiredArgsConstructor
public class BudgetController {

    private final BudgetService budgetService;

    @GetMapping
    public ResponseEntity<BudgetDto.MonthSummary> getMonthSummary(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        return ResponseEntity.ok(budgetService.getMonthSummary(principal.getId()));
    }

    @PostMapping
    public ResponseEntity<BudgetDto.CategoryBudget> setBudget(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestBody BudgetDto.SetRequest request) {
        return ResponseEntity.ok(budgetService.setBudget(principal.getId(), request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBudget(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id) {
        budgetService.deleteBudget(principal.getId(), id);
        return ResponseEntity.noContent().build();
    }
}
