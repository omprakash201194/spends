package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.BankAccountDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.BankAccountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/bank-accounts")
@RequiredArgsConstructor
public class BankAccountController {

    private final BankAccountService bankAccountService;

    @GetMapping
    public ResponseEntity<List<BankAccountDto.Response>> list(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        return ResponseEntity.ok(bankAccountService.getAccountsForUser(principal.getId()));
    }

    @PostMapping
    public ResponseEntity<BankAccountDto.Response> create(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @Valid @RequestBody BankAccountDto.Request request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(bankAccountService.create(principal.getId(), request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<BankAccountDto.Response> update(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id,
            @Valid @RequestBody BankAccountDto.Request request) {
        return ResponseEntity.ok(bankAccountService.update(id, principal.getId(), request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id) {
        bankAccountService.delete(id, principal.getId());
        return ResponseEntity.noContent().build();
    }
}
