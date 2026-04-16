package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.RecurringDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.RecurringService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/recurring")
@RequiredArgsConstructor
public class RecurringController {

    private final RecurringService recurringService;

    @GetMapping
    public ResponseEntity<RecurringDto.RecurringSummary> getPatterns(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        return ResponseEntity.ok(recurringService.getPatterns(principal.getId()));
    }
}
