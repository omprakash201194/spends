package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.AnnualBudgetDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.AnnualBudgetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/annual-budgets")
@RequiredArgsConstructor
public class AnnualBudgetController {

    private final AnnualBudgetService annualBudgetService;

    @GetMapping
    public List<AnnualBudgetDto.Response> getAnnualSummary(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestParam(defaultValue = "0") int year) {
        if (year == 0) year = LocalDate.now().getYear();
        return annualBudgetService.getAnnualSummary(principal.getId(), year);
    }

    @PutMapping
    public AnnualBudgetDto.Response setAnnualBudget(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestBody @Valid AnnualBudgetDto.SetRequest req) {
        return annualBudgetService.setAnnualBudget(principal.getId(), req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAnnualBudget(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id) {
        annualBudgetService.deleteAnnualBudget(principal.getId(), id);
    }
}
