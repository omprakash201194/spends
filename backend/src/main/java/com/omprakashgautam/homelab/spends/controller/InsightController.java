package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.InsightDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.InsightService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/insights")
@RequiredArgsConstructor
public class InsightController {

    private final InsightService insightService;

    @PostMapping("/{type}")
    public ResponseEntity<InsightDto.Response> getInsight(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable InsightDto.InsightType type) {
        return ResponseEntity.ok(insightService.getInsight(principal.getId(), type));
    }
}
