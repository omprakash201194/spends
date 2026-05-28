package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.ForecastDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.ForecastService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/forecast")
@RequiredArgsConstructor
public class ForecastController {

    private final ForecastService forecastService;

    @GetMapping("/monthly")
    public ResponseEntity<ForecastDto.MonthlyForecast> getMonthlyForecast(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        return ResponseEntity.ok(forecastService.getForecast(principal.getId()));
    }
}
