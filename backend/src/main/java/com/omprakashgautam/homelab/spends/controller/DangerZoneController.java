package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.DangerZoneService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@RestController
@RequestMapping("/api/danger-zone")
@RequiredArgsConstructor
public class DangerZoneController {

    private final DangerZoneService dangerZoneService;
    private final UserRepository    userRepository;

    @DeleteMapping("/transactions")
    public ResponseEntity<Void> deleteTransactions(@AuthenticationPrincipal UserDetailsImpl principal) {
        dangerZoneService.deleteAllTransactions(principal.getId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/rules")
    public ResponseEntity<Void> deleteRules(@AuthenticationPrincipal UserDetailsImpl principal) {
        dangerZoneService.deleteAllRules(principal.getId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/budgets")
    public ResponseEntity<Void> deleteBudgets(@AuthenticationPrincipal UserDetailsImpl principal) {
        dangerZoneService.deleteAllBudgets(principal.getId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/views")
    public ResponseEntity<Void> deleteViews(@AuthenticationPrincipal UserDetailsImpl principal) {
        UUID householdId = resolveHouseholdId(principal.getId());
        dangerZoneService.deleteAllViews(householdId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/custom-categories")
    public ResponseEntity<Void> deleteCustomCategories(@AuthenticationPrincipal UserDetailsImpl principal) {
        UUID householdId = resolveHouseholdId(principal.getId());
        dangerZoneService.deleteAllCustomCategories(householdId);
        return ResponseEntity.noContent().build();
    }

    private UUID resolveHouseholdId(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        return user.getHousehold().getId();
    }
}
