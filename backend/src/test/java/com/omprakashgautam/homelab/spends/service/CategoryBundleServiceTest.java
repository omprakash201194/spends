package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.BundleDto.Bundle;
import com.omprakashgautam.homelab.spends.dto.BundleDto.BundleCategory;
import com.omprakashgautam.homelab.spends.dto.BundleDto.BundleRule;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CategoryBundleServiceTest {

    @Mock CategoryRepository categoryRepository;
    @Mock CategoryRuleRepository categoryRuleRepository;
    @Mock TransactionRepository transactionRepository;
    @Mock UserRepository userRepository;
    @InjectMocks CategoryBundleService bundleService;

    private UUID userId;
    private UUID householdId;
    private User user;
    private Household household;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        householdId = UUID.randomUUID();
        household = Household.builder().id(householdId).name("Home").build();
        user = User.builder().id(userId).household(household).build();
    }

    @Test
    void exportBundle_includesCategoriesRulesAndExclusions() {
        UUID catId = UUID.randomUUID();
        Category cat = Category.builder()
                .id(catId).name("Food & Dining").color("#f59e0b").icon("utensils")
                .description("Restaurants and food delivery")
                .household(household).system(false)
                .build();

        CategoryRule include = CategoryRule.builder()
                .pattern("swiggy").priority(100).category(cat).user(user).build();
        CategoryRule exclude = CategoryRule.builder()
                .pattern("tailor").priority(100).category(cat).user(user).exclusion(true).build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(categoryRepository.findByHouseholdId(householdId)).thenReturn(List.of(cat));
        when(categoryRuleRepository.listRulesForUser(userId)).thenReturn(List.of(include, exclude));
        when(transactionRepository.categoryLifetimeStatsForHousehold(householdId)).thenReturn(List.of());

        Bundle bundle = bundleService.exportBundle(userId, "Indian Personal Finance");

        assertThat(bundle.schemaVersion()).isEqualTo("spendstack-bundle/v1");
        assertThat(bundle.metadata().packName()).isEqualTo("Indian Personal Finance");
        assertThat(bundle.categories()).hasSize(1);

        BundleCategory bc = bundle.categories().get(0);
        assertThat(bc.name()).isEqualTo("Food & Dining");
        assertThat(bc.description()).isEqualTo("Restaurants and food delivery");
        assertThat(bc.rules()).extracting(BundleRule::pattern, BundleRule::exclusion)
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple("swiggy", false),
                        org.assertj.core.groups.Tuple.tuple("tailor", true));
    }

    @Test
    void importBundle_createsNewCategoriesAndRules() {
        Bundle bundle = sampleBundle();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(categoryRepository.findBySystemTrueOrHouseholdId(householdId)).thenReturn(List.of());
        when(categoryRuleRepository.listRulesForUser(userId)).thenReturn(List.of());
        when(categoryRepository.save(any(Category.class)))
                .thenAnswer(inv -> {
                    Category c = inv.getArgument(0);
                    c.setId(UUID.randomUUID());
                    return c;
                });

        ImportSummary result = bundleService.importBundle(userId, bundle, false);

        assertThat(result.dryRun()).isFalse();
        assertThat(result.categoriesCreated()).isEqualTo(1);
        assertThat(result.categoriesSkipped()).isZero();
        assertThat(result.rulesCreated()).isEqualTo(2);
        assertThat(result.rulesSkipped()).isZero();
        assertThat(result.errors()).isEmpty();

        ArgumentCaptor<CategoryRule> ruleCaptor = ArgumentCaptor.forClass(CategoryRule.class);
        verify(categoryRuleRepository, org.mockito.Mockito.times(2)).save(ruleCaptor.capture());
        assertThat(ruleCaptor.getAllValues())
                .extracting(CategoryRule::getPattern, CategoryRule::isExclusion)
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple("swiggy", false),
                        org.assertj.core.groups.Tuple.tuple("tailor", true));
    }

    @Test
    void importBundle_dryRunPersistsNothing() {
        Bundle bundle = sampleBundle();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(categoryRepository.findBySystemTrueOrHouseholdId(householdId)).thenReturn(List.of());
        when(categoryRuleRepository.listRulesForUser(userId)).thenReturn(List.of());

        ImportSummary result = bundleService.importBundle(userId, bundle, true);

        assertThat(result.dryRun()).isTrue();
        assertThat(result.categoriesCreated()).isEqualTo(1);
        assertThat(result.rulesCreated()).isEqualTo(2);

        verify(categoryRepository, never()).save(any());
        verify(categoryRuleRepository, never()).save(any());
    }

    @Test
    void importBundle_existingCategoryByNameSkipsCategoryAttachesRules() {
        Bundle bundle = sampleBundle();
        Category existing = Category.builder()
                .id(UUID.randomUUID()).name("Food & Dining")
                .household(household).system(false).build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(categoryRepository.findBySystemTrueOrHouseholdId(householdId)).thenReturn(List.of(existing));
        when(categoryRuleRepository.listRulesForUser(userId)).thenReturn(List.of());

        ImportSummary result = bundleService.importBundle(userId, bundle, false);

        assertThat(result.categoriesCreated()).isZero();
        assertThat(result.categoriesSkipped()).isEqualTo(1);
        assertThat(result.rulesCreated()).isEqualTo(2);
        verify(categoryRepository, never()).save(any());
    }

    @Test
    void importBundle_skipsDuplicateRulePatterns() {
        Bundle bundle = sampleBundle();
        Category existing = Category.builder()
                .id(UUID.randomUUID()).name("Food & Dining")
                .household(household).system(false).build();
        CategoryRule existingRule = CategoryRule.builder()
                .pattern("swiggy").priority(0).category(existing).user(user).build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(categoryRepository.findBySystemTrueOrHouseholdId(householdId)).thenReturn(List.of(existing));
        when(categoryRuleRepository.listRulesForUser(userId)).thenReturn(List.of(existingRule));

        ImportSummary result = bundleService.importBundle(userId, bundle, false);

        assertThat(result.rulesCreated()).isEqualTo(1);
        assertThat(result.rulesSkipped()).isEqualTo(1);
    }

    @Test
    void importBundle_resolvesParentBeforeChildAcrossPasses() {
        BundleCategory child = new BundleCategory(
                "Restaurants", "#f59e0b", null, "Food", null,
                List.of(), null);
        BundleCategory parent = new BundleCategory(
                "Food", "#ef4444", null, null, null,
                List.of(), null);
        // Child appears BEFORE parent in the list — multi-pass should still resolve.
        Bundle bundle = new Bundle("spendstack-bundle/v1",
                new Metadata(Instant.now(), null, "INR"),
                List.of(child, parent));

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(categoryRepository.findBySystemTrueOrHouseholdId(householdId)).thenReturn(List.of());
        when(categoryRuleRepository.listRulesForUser(userId)).thenReturn(List.of());
        when(categoryRepository.save(any(Category.class)))
                .thenAnswer(inv -> {
                    Category c = inv.getArgument(0);
                    c.setId(UUID.randomUUID());
                    return c;
                });

        ImportSummary result = bundleService.importBundle(userId, bundle, false);

        assertThat(result.categoriesCreated()).isEqualTo(2);
        assertThat(result.errors()).isEmpty();
    }

    @Test
    void importBundle_rejectsUnknownSchemaVersion() {
        Bundle bad = new Bundle("custom-format/v9",
                new Metadata(Instant.now(), null, "INR"), List.of());

        assertThatThrownBy(() -> bundleService.importBundle(userId, bad, false))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("schema");
    }

    private Bundle sampleBundle() {
        BundleCategory cat = new BundleCategory(
                "Food & Dining", "#f59e0b", "utensils", null,
                "Restaurants and food delivery",
                List.of(
                        new BundleRule("swiggy", 100, false),
                        new BundleRule("tailor", 100, true)
                ),
                null);
        return new Bundle("spendstack-bundle/v1",
                new Metadata(Instant.now(), "Test Pack", "INR"),
                List.of(cat));
    }
}
