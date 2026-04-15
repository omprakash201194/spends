package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.TransactionDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.TransactionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/transactions")
@RequiredArgsConstructor
public class TransactionController {

    private final TransactionService transactionService;

    /**
     * Paginated, filterable transaction list.
     *
     * Query params:
     *   search     – text search on remarks / merchant (optional)
     *   categoryId – filter by category UUID (optional)
     *   accountId  – filter by bank account UUID (optional)
     *   type       – DEBIT | CREDIT | ALL (default ALL)
     *   dateFrom   – ISO date yyyy-MM-dd (optional)
     *   dateTo     – ISO date yyyy-MM-dd (optional)
     *   page       – 0-based page number (default 0)
     *   size       – page size (default 25)
     *   sortBy     – valueDate | txDate | merchant | withdrawal | deposit | balance (default valueDate)
     *   sortDir    – asc | desc (default desc)
     */
    @GetMapping
    public ResponseEntity<TransactionDto.PagedResponse> list(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UUID categoryId,
            @RequestParam(required = false) UUID accountId,
            @RequestParam(defaultValue = "ALL") String type,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "valueDate") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir
    ) {
        return ResponseEntity.ok(transactionService.list(
                principal.getId(), search, categoryId, accountId,
                type, dateFrom, dateTo, page, size, sortBy, sortDir
        ));
    }

    @PatchMapping("/{id}/category")
    public ResponseEntity<TransactionDto.Response> updateCategory(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id,
            @Valid @RequestBody TransactionDto.CategoryUpdateRequest request
    ) {
        return ResponseEntity.ok(transactionService.updateCategory(id, principal.getId(), request));
    }

    @PatchMapping("/{id}/reviewed")
    public ResponseEntity<TransactionDto.Response> toggleReviewed(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id
    ) {
        return ResponseEntity.ok(transactionService.toggleReviewed(id, principal.getId()));
    }
}
