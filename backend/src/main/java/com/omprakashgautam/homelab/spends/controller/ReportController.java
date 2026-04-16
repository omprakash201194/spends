package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.ReportDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.ReportService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
@Validated
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/available-years")
    public ResponseEntity<List<Integer>> getAvailableYears(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        return ResponseEntity.ok(reportService.getAvailableYears(principal.getId()));
    }

    @GetMapping("/monthly-summary")
    public ResponseEntity<ReportDto.YearSummary> getMonthlySummary(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestParam @Min(1900) @Max(2200) int year) {
        return ResponseEntity.ok(reportService.getMonthlySummary(principal.getId(), year));
    }
}
