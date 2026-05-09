package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.BundleDto;
import com.omprakashgautam.homelab.spends.dto.BundleDto.Bundle;
import com.omprakashgautam.homelab.spends.dto.BundleDto.BundleCategory;
import com.omprakashgautam.homelab.spends.dto.BundleDto.BundleRule;
import com.omprakashgautam.homelab.spends.dto.BundleDto.BundleStats;
import com.omprakashgautam.homelab.spends.dto.BundleDto.ImportSummary;
import com.omprakashgautam.homelab.spends.dto.BundleDto.Metadata;
import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.CategoryRule;
import com.omprakashgautam.homelab.spends.model.Household;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
import com.omprakashgautam.homelab.spends.repository.CategoryRuleRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Export and import the cross-installation category bundle (categories + rules +
 * exclusions + descriptions). Designed so a household can share their curated
 * taxonomy as a single JSON file, and a recipient can preview before applying.
 *
 * Schema version: spendstack-bundle/v1
 */
@Service
@RequiredArgsConstructor
public class CategoryBundleService {

    public static final String SCHEMA_VERSION = "spendstack-bundle/v1";
    private static final int SAMPLE_REMARKS_LIMIT = 3;

    private final CategoryRepository categoryRepository;
    private final CategoryRuleRepository categoryRuleRepository;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public Bundle exportBundle(UUID userId, String packName) {
        User user = userRepository.findById(userId).orElseThrow();
        Household household = user.getHousehold();
        UUID householdId = household.getId();

        // Custom categories belong to this household; rules belong to the user (per-user scope).
        List<Category> custom = categoryRepository.findByHouseholdId(householdId);
        List<CategoryRule> userRules = categoryRuleRepository.listRulesForUser(userId);

        // Index rules by category id so we attach them in O(N).
        Map<UUID, List<CategoryRule>> rulesByCategoryId = new HashMap<>();
        for (CategoryRule r : userRules) {
            rulesByCategoryId
                    .computeIfAbsent(r.getCategory().getId(), k -> new ArrayList<>())
                    .add(r);
        }

        // Lifetime stats are per-category aggregates over the household's transactions.
        Map<UUID, long[]> countByCat = new HashMap<>();         // [count]
        Map<UUID, BigDecimal> totalByCat = new HashMap<>();
        for (Object[] row : transactionRepository.categoryLifetimeStatsForHousehold(householdId)) {
            UUID catId = (UUID) row[0];
            long count = ((Number) row[1]).longValue();
            BigDecimal total = (BigDecimal) row[2];
            countByCat.put(catId, new long[]{count});
            totalByCat.put(catId, total);
        }

        List<BundleCategory> categories = new ArrayList<>(custom.size());
        for (Category c : custom) {
            String parentName = c.getParent() != null ? c.getParent().getName() : null;
            List<BundleRule> rules = rulesByCategoryId.getOrDefault(c.getId(), List.of()).stream()
                    .map(r -> new BundleRule(r.getPattern(), r.getPriority(), r.isExclusion()))
                    .toList();

            BundleStats stats = buildStats(c, householdId, countByCat, totalByCat);

            categories.add(new BundleCategory(
                    c.getName(), c.getColor(), c.getIcon(),
                    parentName, c.getDescription(),
                    rules, stats
            ));
        }

        Metadata metadata = new Metadata(
                Instant.now(),
                packName != null && !packName.isBlank() ? packName.trim() : null,
                "INR"
        );
        return new Bundle(SCHEMA_VERSION, metadata, categories);
    }

    private BundleStats buildStats(Category c, UUID householdId,
                                   Map<UUID, long[]> countByCat, Map<UUID, BigDecimal> totalByCat) {
        long count = countByCat.getOrDefault(c.getId(), new long[]{0})[0];
        BigDecimal total = totalByCat.getOrDefault(c.getId(), BigDecimal.ZERO);
        List<String> samples = new ArrayList<>();
        if (count > 0) {
            for (Object[] row : transactionRepository.sampleRemarksForCategory(
                    householdId, c.getId(), PageRequest.of(0, SAMPLE_REMARKS_LIMIT))) {
                String remarks = (String) row[0];
                if (remarks != null && !remarks.isBlank()) {
                    samples.add(remarks);
                }
            }
        }
        return new BundleStats(count, total, samples);
    }

    @Transactional
    public ImportSummary importBundle(UUID userId, Bundle bundle, boolean dryRun) {
        if (bundle == null) {
            return new ImportSummary(dryRun, 0, 0, 0, 0,
                    List.of("Bundle is empty"));
        }
        validateSchema(bundle);

        User user = userRepository.findById(userId).orElseThrow();
        Household household = user.getHousehold();
        List<String> errors = new ArrayList<>();

        ImportCounters counters = new ImportCounters();
        ImportContext ctx = new ImportContext(user, household, dryRun, errors, counters);

        // Pass 1 (multi-pass) — create / locate categories. Same parent-before-child
        // algorithm as the legacy /import endpoint so deeply nested packs still resolve.
        Map<String, Category> resolvedByName = importCategories(bundle.categories(), ctx);

        // Pass 2 — attach rules to whichever category resolved (newly created or existing).
        importRules(bundle.categories(), resolvedByName, ctx);

        return new ImportSummary(
                dryRun,
                counters.categoriesCreated, counters.categoriesSkipped,
                counters.rulesCreated, counters.rulesSkipped,
                errors
        );
    }

    private void validateSchema(Bundle bundle) {
        if (bundle.schemaVersion() == null || !bundle.schemaVersion().startsWith("spendstack-bundle/")) {
            throw new IllegalArgumentException(
                    "Unrecognised bundle schema: " + bundle.schemaVersion());
        }
    }

    private Map<String, Category> importCategories(List<BundleCategory> entries, ImportContext ctx) {
        Map<String, Category> resolved = caseInsensitiveMap();
        for (Category existing : categoryRepository.findBySystemTrueOrHouseholdId(ctx.household.getId())) {
            resolved.put(existing.getName(), existing);
        }
        if (entries == null || entries.isEmpty()) return resolved;

        List<BundleCategory> remaining = new ArrayList<>(entries);
        boolean progress = true;
        while (!remaining.isEmpty() && progress) {
            progress = false;
            List<BundleCategory> retry = new ArrayList<>();
            for (BundleCategory bc : remaining) {
                if (resolved.containsKey(bc.name())) {
                    // Existing category by name — merge mode keeps rules attaching to it.
                    ctx.counters.categoriesSkipped++;
                    progress = true;
                    continue;
                }
                Category parent = null;
                if (bc.parentName() != null) {
                    parent = resolved.get(bc.parentName());
                    if (parent == null) {
                        retry.add(bc);
                        continue;
                    }
                }
                Category created = Category.builder()
                        .name(bc.name())
                        .color(bc.color() != null ? bc.color() : "#94a3b8")
                        .icon(bc.icon() != null && !bc.icon().isBlank() ? bc.icon() : null)
                        .description(bc.description() != null && !bc.description().isBlank()
                                ? bc.description() : null)
                        .household(ctx.household)
                        .system(false)
                        .parent(parent)
                        .build();
                if (!ctx.dryRun) {
                    created = categoryRepository.save(created);
                }
                resolved.put(bc.name(), created);
                ctx.counters.categoriesCreated++;
                progress = true;
            }
            remaining = retry;
        }
        for (BundleCategory bc : remaining) {
            ctx.errors.add("Parent '" + bc.parentName() + "' not found for '" + bc.name() + "' — category skipped");
        }
        return resolved;
    }

    private void importRules(List<BundleCategory> entries, Map<String, Category> resolvedByName,
                             ImportContext ctx) {
        if (entries == null || entries.isEmpty()) return;

        List<CategoryRule> existingRules = categoryRuleRepository.listRulesForUser(ctx.user.getId());
        // Dedup key matches the legacy rule-import: pattern alone (regardless of category).
        Map<String, Boolean> existingPatterns = caseInsensitiveBoolMap();
        for (CategoryRule r : existingRules) {
            existingPatterns.put(r.getPattern(), true);
        }

        for (BundleCategory bc : entries) {
            if (bc.rules() == null || bc.rules().isEmpty()) continue;
            Category target = resolvedByName.get(bc.name());
            if (target == null) {
                // Category was unresolvable in pass 1; rules can't attach.
                ctx.errors.add("Skipping " + bc.rules().size()
                        + " rule(s) for unresolved category '" + bc.name() + "'");
                continue;
            }
            for (BundleRule br : bc.rules()) {
                if (br.pattern() == null || br.pattern().isBlank()) {
                    ctx.errors.add("Empty pattern in '" + bc.name() + "' — skipped");
                    continue;
                }
                String normalised = br.pattern().trim().toLowerCase(Locale.ROOT);
                if (existingPatterns.containsKey(normalised)) {
                    ctx.counters.rulesSkipped++;
                    continue;
                }
                CategoryRule rule = CategoryRule.builder()
                        .user(ctx.user)
                        .pattern(normalised)
                        .category(target)
                        .priority(br.priority())
                        .global(false)
                        .aiGenerated(false)
                        .exclusion(br.exclusion())
                        .build();
                if (!ctx.dryRun) {
                    categoryRuleRepository.save(rule);
                }
                existingPatterns.put(normalised, true);
                ctx.counters.rulesCreated++;
            }
        }
    }

    private static Map<String, Category> caseInsensitiveMap() {
        return new java.util.TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    }

    private static Map<String, Boolean> caseInsensitiveBoolMap() {
        return new java.util.TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    }

    private static final class ImportCounters {
        int categoriesCreated;
        int categoriesSkipped;
        int rulesCreated;
        int rulesSkipped;
    }

    private record ImportContext(User user, Household household, boolean dryRun,
                                 List<String> errors, ImportCounters counters) {}
}
