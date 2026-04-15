package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.AlertDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.AlertService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
public class AlertController {

    private final AlertService alertService;

    @GetMapping
    public ResponseEntity<AlertDto.AlertSummary> getAlerts(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        return ResponseEntity.ok(alertService.getAlerts(principal.getId()));
    }
}
