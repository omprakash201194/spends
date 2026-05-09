package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.CategoryRule;
import com.omprakashgautam.homelab.spends.repository.CategoryRuleRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CategorizationServiceTest {

    @Mock CategoryRuleRepository categoryRuleRepository;
    @Mock TransactionRepository transactionRepository;
    @InjectMocks CategorizationService categorizationService;

    @Test
    void categorize_returnsHighestPriorityMatch() {
        UUID userId = UUID.randomUUID();
        Category food = cat("Food");
        Category transport = cat("Transport");

        when(categoryRuleRepository.findAllApplicableRules(userId))
                .thenReturn(List.of(
                        rule("swiggy", food, 100, false),
                        rule("uber", transport, 50, false)
                ));

        Category result = categorizationService.categorize(userId, "UPI/SWIGGY-FOOD-DELIVERY");

        assertThat(result).isEqualTo(food);
    }

    @Test
    void categorize_exclusionRuleSuppressesItsCategoryEvenIfOtherKeywordMatches() {
        UUID userId = UUID.randomUUID();
        Category food = cat("Food");
        Category services = cat("Personal Services");

        // "tailor" is an exclusion under Food and an inclusion under Personal Services.
        // Description "TAILOR FOR FOOD UNIFORM" matches both — Food must be suppressed.
        when(categoryRuleRepository.findAllApplicableRules(userId))
                .thenReturn(List.of(
                        rule("food", food, 100, false),
                        rule("tailor", food, 100, true),
                        rule("tailor", services, 50, false)
                ));

        Category result = categorizationService.categorize(userId, "TAILOR FOR FOOD UNIFORM");

        assertThat(result).isEqualTo(services);
    }

    @Test
    void categorize_exclusionDoesNotAffectOtherCategories() {
        UUID userId = UUID.randomUUID();
        Category food = cat("Food");
        Category transport = cat("Transport");

        // "tailor" exclusion on Food shouldn't prevent Transport from matching "uber".
        when(categoryRuleRepository.findAllApplicableRules(userId))
                .thenReturn(List.of(
                        rule("tailor", food, 100, true),
                        rule("uber", transport, 50, false)
                ));

        Category result = categorizationService.categorize(userId, "UBER RIDE WITH TAILOR DROP");

        assertThat(result).isEqualTo(transport);
    }

    @Test
    void categorize_noExclusionRulesPreservesOriginalBehavior() {
        UUID userId = UUID.randomUUID();
        Category food = cat("Food");

        when(categoryRuleRepository.findAllApplicableRules(userId))
                .thenReturn(List.of(rule("swiggy", food, 100, false)));

        assertThat(categorizationService.categorize(userId, "UPI/SWIGGY")).isEqualTo(food);
        assertThat(categorizationService.categorize(userId, "UPI/RANDOM-MERCHANT")).isNull();
    }

    private Category cat(String name) {
        return Category.builder().id(UUID.randomUUID()).name(name).build();
    }

    private CategoryRule rule(String pattern, Category category, int priority, boolean exclusion) {
        return CategoryRule.builder()
                .id(UUID.randomUUID())
                .pattern(pattern)
                .category(category)
                .priority(priority)
                .exclusion(exclusion)
                .build();
    }
}
