package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.SettlementDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.SettlementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/settlements")
@RequiredArgsConstructor
public class SettlementController {

    private final SettlementService settlementService;

    @GetMapping
    public List<SettlementDto.Response> list(@AuthenticationPrincipal UserDetailsImpl principal) {
        return settlementService.list(principal.getId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SettlementDto.Response create(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestBody @Valid SettlementDto.CreateRequest req) {
        return settlementService.create(principal.getId(), req);
    }

    @PatchMapping("/{id}/settle")
    public SettlementDto.Response markSettled(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id) {
        return settlementService.markSettled(id, principal.getId());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id) {
        settlementService.delete(id, principal.getId());
    }
}
