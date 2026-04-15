package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.HouseholdDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.HouseholdService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/household")
@RequiredArgsConstructor
public class HouseholdController {

    private final HouseholdService householdService;

    @GetMapping
    public ResponseEntity<HouseholdDto.Summary> getSummary(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        return ResponseEntity.ok(householdService.getSummary(principal.getId()));
    }
}
