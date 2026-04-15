package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.CategoryRule;
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
import com.omprakashgautam.homelab.spends.repository.CategoryRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Assigns a category to a transaction by matching its raw remarks against
 * user-specific and global CategoryRule patterns (case-insensitive substring).
 *
 * Rule priority:
 *   1. User rules ordered by priority DESC
 *   2. Global rules ordered by priority DESC
 *
 * Falls back to the "Miscellaneous" system category if no rule matches.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CategorizationService {

    private final CategoryRuleRepository categoryRuleRepository;
    private final CategoryRepository categoryRepository;

    private Category miscellaneous;

    /**
     * Finds the best matching category for the given raw transaction remarks.
     *
     * @param userId     the user whose rules should be consulted
     * @param rawRemarks the raw transaction remarks from the bank statement
     * @return the matched Category (never null — falls back to Miscellaneous)
     */
    public Category categorize(UUID userId, String rawRemarks) {
        if (rawRemarks == null || rawRemarks.isBlank()) {
            return getMiscellaneous();
        }

        String lowerRemarks = rawRemarks.toLowerCase(Locale.ROOT);
        List<CategoryRule> rules = categoryRuleRepository.findAllApplicableRules(userId);

        for (CategoryRule rule : rules) {
            if (lowerRemarks.contains(rule.getPattern().toLowerCase(Locale.ROOT))) {
                return rule.getCategory();
            }
        }

        return getMiscellaneous();
    }

    private Category getMiscellaneous() {
        if (miscellaneous == null) {
            miscellaneous = categoryRepository.findByName("Miscellaneous")
                    .orElseThrow(() -> new IllegalStateException(
                            "Miscellaneous category not seeded — check migration 002"));
        }
        return miscellaneous;
    }
}
