package com.omprakashgautam.homelab.spends.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Shareable category bundle format. Carries categories, their per-category rules
 * (including exclusions), descriptions, and optional display-only stats. Designed
 * for round-trip export/import between SpendStack households so users can swap
 * curated category packs.
 *
 * Schema version: spendstack-bundle/v1
 */
public final class BundleDto {

    private BundleDto() {}

    public record Bundle(
            String schemaVersion,
            Metadata metadata,
            List<BundleCategory> categories
    ) {}

    public record Metadata(
            Instant exportedAt,
            String packName,
            String currency
    ) {}

    public record BundleCategory(
            String name,
            String color,
            String icon,
            String parentName,
            String description,
            List<BundleRule> rules,
            BundleStats stats          // export-only, ignored on import
    ) {}

    public record BundleRule(
            String pattern,
            int priority,
            boolean exclusion
    ) {}

    /** Display-only — computed at export time, never persisted. */
    public record BundleStats(
            long transactionCount,
            BigDecimal totalAmount,
            List<String> sampleTransactions
    ) {}

    /**
     * Result of an import (or preview). Counts apply to the union of categories + rules.
     * `dryRun=true` means nothing was persisted.
     */
    public record ImportSummary(
            boolean dryRun,
            int categoriesCreated,
            int categoriesSkipped,
            int rulesCreated,
            int rulesSkipped,
            List<String> errors
    ) {}
}
