package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.NetWorthDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.NetWorthService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/net-worth")
@RequiredArgsConstructor
public class NetWorthController {

    private final NetWorthService netWorthService;

    @GetMapping
    public NetWorthDto.Response getNetWorth(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestParam(defaultValue = "12") int months) {
        return netWorthService.getNetWorth(principal.getId(), months);
    }
}
