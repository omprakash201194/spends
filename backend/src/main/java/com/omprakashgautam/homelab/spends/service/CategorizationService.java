package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.CategoryRule;
import com.omprakashgautam.homelab.spends.model.Transaction;
import com.omprakashgautam.homelab.spends.repository.CategoryRuleRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
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
    private final TransactionRepository transactionRepository;

    public record ReapplyResult(int updated) {}

    @Transactional
    public ReapplyResult reapplyRules(UUID userId) {
        List<Transaction> transactions = transactionRepository.findAllByBankAccountUserId(userId);
        int updated = 0;
        for (Transaction t : transactions) {
            Category newCategory = categorize(userId, t.getRawRemarks());
            UUID newId = newCategory != null ? newCategory.getId() : null;
            UUID curId = t.getCategory() != null ? t.getCategory().getId() : null;
            if (!Objects.equals(curId, newId)) {
                t.setCategory(newCategory);
                updated++;
            }
        }
        return new ReapplyResult(updated);
    }

    /**
     * Finds the best matching category for the given raw transaction remarks.
     *
     * @param userId     the user whose rules should be consulted
     * @param rawRemarks the raw transaction remarks from the bank statement
     * @return the matched Category, or null if no rule matches
     */
    public Category categorize(UUID userId, String rawRemarks) {
        if (rawRemarks == null || rawRemarks.isBlank()) {
            return null;
        }

        String lowerRemarks = rawRemarks.toLowerCase(Locale.ROOT);
        List<CategoryRule> rules = categoryRuleRepository.findAllApplicableRules(userId);

        for (CategoryRule rule : rules) {
            if (matchesPattern(lowerRemarks, rule.getPattern())) {
                return rule.getCategory();
            }
        }

        return null;
    }

    /**
     * Evaluates a rule pattern against lowercased remarks.
     * Supports: "term1 and term2" (all must match), "term1 or term2" (any must match),
     * "-term" / "!term" prefix (must NOT match). Simple patterns are plain contains.
     */
    private boolean matchesPattern(String lowerRemarks, String pattern) {
        String raw = pattern.trim();
        String[] terms;
        boolean orMode;
        if (raw.toLowerCase(Locale.ROOT).contains(" or ")) {
            terms = raw.split("(?i)\\s+or\\s+");
            orMode = true;
        } else if (raw.toLowerCase(Locale.ROOT).contains(" and ")) {
            terms = raw.split("(?i)\\s+and\\s+");
            orMode = false;
        } else {
            return lowerRemarks.contains(raw.toLowerCase(Locale.ROOT));
        }
        boolean positiveResult = orMode ? false : true;
        for (String term : terms) {
            String t = term.trim();
            boolean negate = t.startsWith("-") || t.startsWith("!");
            String word = (negate ? t.substring(1) : t).toLowerCase(Locale.ROOT);
            if (word.isBlank()) continue;
            boolean found = lowerRemarks.contains(word);
            if (negate) {
                if (found) return false;
            } else {
                if (orMode) { if (found) positiveResult = true; }
                else        { if (!found) positiveResult = false; }
            }
        }
        return positiveResult;
    }

}
