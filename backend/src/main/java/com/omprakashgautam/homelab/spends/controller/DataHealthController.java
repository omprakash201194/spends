package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.DataHealthDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.DataHealthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/data-health")
@RequiredArgsConstructor
public class DataHealthController {

    private final DataHealthService dataHealthService;

    @GetMapping
    public ResponseEntity<DataHealthDto.Report> getReport(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        return ResponseEntity.ok(dataHealthService.getReport(principal.getId()));
    }
}
