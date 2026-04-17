package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.MerchantAliasDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.MerchantAliasService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/merchant-aliases")
@RequiredArgsConstructor
public class MerchantAliasController {

    private final MerchantAliasService merchantAliasService;

    @GetMapping
    public List<MerchantAliasDto.Response> list(@AuthenticationPrincipal UserDetailsImpl principal) {
        return merchantAliasService.list(principal.getId());
    }

    @PostMapping
    public MerchantAliasDto.Response save(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestBody @Valid MerchantAliasDto.SaveRequest req) {
        return merchantAliasService.save(principal.getId(), req.rawPattern(), req.displayName());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id) {
        merchantAliasService.delete(id, principal.getId());
    }
}
