package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.ViewDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.ViewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/views")
@RequiredArgsConstructor
public class ViewController {

    private final ViewService viewService;

    @GetMapping
    public ResponseEntity<List<ViewDto.ViewResponse>> listViews(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        return ResponseEntity.ok(viewService.listViews(principal.getId()));
    }

    @PostMapping
    public ResponseEntity<ViewDto.ViewResponse> createView(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestBody ViewDto.CreateRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(viewService.createView(principal.getId(), req));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ViewDto.ViewResponse> getView(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id) {
        return ResponseEntity.ok(viewService.getView(principal.getId(), id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ViewDto.ViewResponse> updateView(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id,
            @RequestBody ViewDto.UpdateRequest req) {
        return ResponseEntity.ok(viewService.updateView(principal.getId(), id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteView(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id) {
        viewService.deleteView(principal.getId(), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/transactions")
    public ResponseEntity<ViewDto.TransactionPage> getTransactions(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return ResponseEntity.ok(viewService.getTransactions(principal.getId(), id, page, size));
    }

    @GetMapping("/{id}/summary")
    public ResponseEntity<ViewDto.SummaryResponse> getSummary(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id) {
        return ResponseEntity.ok(viewService.getSummary(principal.getId(), id));
    }

    @PostMapping("/{id}/transactions")
    public ResponseEntity<Void> addTransactions(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id,
            @RequestBody ViewDto.AddTransactionsRequest req) {
        viewService.addTransactions(principal.getId(), id, req.transactionIds());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/transactions/{txId}")
    public ResponseEntity<Void> removeTransaction(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id,
            @PathVariable UUID txId) {
        viewService.removeTransaction(principal.getId(), id, txId);
        return ResponseEntity.noContent().build();
    }
}
