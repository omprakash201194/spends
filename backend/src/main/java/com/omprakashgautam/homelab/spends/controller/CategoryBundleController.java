package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.BundleDto.Bundle;
import com.omprakashgautam.homelab.spends.dto.BundleDto.ImportSummary;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.CategoryBundleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

/**
 * Cross-installation category bundle endpoints. Lives alongside the legacy
 * /api/categories/{export,import} endpoints (which keep working unchanged) and
 * adds a richer, shareable format that bundles categories + rules + exclusions.
 */
@RestController
@RequestMapping("/api/categories/bundle")
@RequiredArgsConstructor
public class CategoryBundleController {

    private final CategoryBundleService bundleService;

    @GetMapping("/export")
    public ResponseEntity<Bundle> export(@AuthenticationPrincipal UserDetailsImpl principal,
                                         @RequestParam(required = false) String packName) {
        Bundle bundle = bundleService.exportBundle(principal.getId(), packName);
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"spendstack-bundle.json\"")
                .body(bundle);
    }

    @PostMapping("/import")
    public ResponseEntity<ImportSummary> importBundle(@AuthenticationPrincipal UserDetailsImpl principal,
                                                      @RequestBody Bundle bundle) {
        try {
            return ResponseEntity.ok(bundleService.importBundle(principal.getId(), bundle, false));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(BAD_REQUEST, e.getMessage());
        }
    }

    @PostMapping("/preview")
    public ResponseEntity<ImportSummary> preview(@AuthenticationPrincipal UserDetailsImpl principal,
                                                 @RequestBody Bundle bundle) {
        try {
            return ResponseEntity.ok(bundleService.importBundle(principal.getId(), bundle, true));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(BAD_REQUEST, e.getMessage());
        }
    }
}
