package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.ImportBatchDto;
import com.omprakashgautam.homelab.spends.dto.ImportResultDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.ImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/import")
@RequiredArgsConstructor
public class ImportController {

    private final ImportService importService;

    /**
     * Upload one or more ICICI bank statement XLS/XLSX files.
     * Returns a summary of imported, duplicate, and error counts.
     */
    @PostMapping(value = "/icici", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportResultDto.Response> importIcici(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestPart("files") List<MultipartFile> files) {

        if (files == null || files.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        ImportResultDto.Response result = importService.importIciciFiles(principal.getId(), files);
        return ResponseEntity.ok(result);
    }

    /** Upload one or more Bank of Baroda account statement CSV files. */
    @PostMapping(value = "/bob", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportResultDto.Response> importBob(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestPart("files") List<MultipartFile> files) {

        if (files == null || files.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(importService.importBobFiles(principal.getId(), files));
    }

    /** Upload one or more Kotak Mahindra Bank account statement CSV files. */
    @PostMapping(value = "/kotak", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportResultDto.Response> importKotak(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestPart("files") List<MultipartFile> files) {

        if (files == null || files.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(importService.importKotakFiles(principal.getId(), files));
    }

    /**
     * Returns all import batches for the current user, newest first.
     */
    @GetMapping("/history")
    public ResponseEntity<ImportBatchDto.HistoryResponse> getHistory(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        return ResponseEntity.ok(importService.getHistory(principal.getId()));
    }

    /**
     * Deletes a specific import batch and all its transactions (via DB cascade).
     * Returns 404 if the batch does not exist or does not belong to the user.
     */
    @DeleteMapping("/batches/{batchId}")
    public ResponseEntity<Void> deleteBatch(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID batchId) {
        importService.deleteBatch(principal.getId(), batchId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Deletes ALL transactions for the current user across all accounts and batches.
     * This is irreversible.
     */
    @DeleteMapping("/all")
    public ResponseEntity<Void> deleteAll(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        importService.deleteAll(principal.getId());
        return ResponseEntity.noContent().build();
    }
}
