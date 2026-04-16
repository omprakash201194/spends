package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.ExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/export")
@RequiredArgsConstructor
public class ExportController {

    private final ExportService exportService;

    /**
     * Downloads all transactions matching the provided filters as a CSV file.
     * Accepts the same filter params as GET /api/transactions (minus pagination/sort).
     */
    @GetMapping("/transactions")
    public ResponseEntity<byte[]> exportTransactions(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UUID categoryId,
            @RequestParam(required = false) UUID accountId,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo) {

        String csv = exportService.exportTransactionsCsv(
                principal.getId(), search, categoryId, accountId, type, dateFrom, dateTo);
        byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);
        String filename = "transactions-" + LocalDate.now() + ".csv";

        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                .header("Content-Type", "text/csv; charset=UTF-8")
                .body(bytes);
    }
}
