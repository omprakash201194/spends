package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.Household;
import com.omprakashgautam.homelab.spends.model.Role;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CategoryControllerTest {

    @Mock CategoryRepository categoryRepository;
    @Mock UserRepository userRepository;

    @InjectMocks CategoryController controller;

    private UUID householdId;
    private Household household;
    private User user;
    private UserDetailsImpl principal;

    @BeforeEach
    void setUp() {
        householdId = UUID.randomUUID();
        household = Household.builder()
                .id(householdId)
                .name("Test")
                .inviteCode("ABCD1234")
                .maxCategoryDepth(5)
                .build();
        user = User.builder()
                .id(UUID.randomUUID())
                .household(household)
                .username("testuser")
                .email("test@example.com")
                .passwordHash("hash")
                .displayName("Test User")
                .role(Role.MEMBER)
                .build();
        principal = UserDetailsImpl.build(user);
        when(userRepository.findById(any())).thenReturn(Optional.of(user));
    }

    @Test
    void create_withValidParent_setsParentOnSavedCategory() {
        Category parent = Category.builder().id(UUID.randomUUID()).name("Food").color("#f00").system(true).build();
        when(categoryRepository.findBySystemTrueOrHouseholdId(householdId))
                .thenReturn(List.of(parent));
        when(categoryRepository.existsByNameAndHouseholdId(anyString(), any())).thenReturn(false);
        when(categoryRepository.save(any())).thenAnswer(inv -> {
            Category c = inv.getArgument(0);
            c.setId(UUID.randomUUID());
            return c;
        });

        var req = new CategoryController.CreateRequest("Swiggy", "#00f", parent.getId());
        var response = controller.create(principal, req);

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody().parentId()).isEqualTo(parent.getId());
    }

    @Test
    void create_exceedingMaxDepth_throwsBadRequest() {
        household = Household.builder()
                .id(householdId).name("Test").inviteCode("ABCD1234")
                .maxCategoryDepth(1) // max depth = 1 means only root categories allowed
                .build();
        user = User.builder()
                .id(UUID.randomUUID())
                .household(household)
                .username("testuser2")
                .email("test2@example.com")
                .passwordHash("hash")
                .displayName("Test User 2")
                .role(Role.MEMBER)
                .build();
        when(userRepository.findById(any())).thenReturn(Optional.of(user));

        Category parent = Category.builder().id(UUID.randomUUID()).name("Food").system(true).build();
        when(categoryRepository.findBySystemTrueOrHouseholdId(householdId)).thenReturn(List.of(parent));
        when(categoryRepository.existsByNameAndHouseholdId(anyString(), any())).thenReturn(false);

        var req = new CategoryController.CreateRequest("Swiggy", "#00f", parent.getId());
        var ex = assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> controller.create(principal, req));
        assertThat(ex.getStatusCode().value()).isEqualTo(400);
        assertThat(ex.getReason()).contains("depth");
    }

    @Test
    void update_withNullParentId_doesNotClearParent() {
        UUID catId = UUID.randomUUID();
        Category existingParent = Category.builder().id(UUID.randomUUID()).name("Food").system(true).build();
        Category cat = Category.builder().id(catId).name("Swiggy").color("#00f")
                .household(household).system(false).parent(existingParent).build();
        when(categoryRepository.findById(catId)).thenReturn(Optional.of(cat));
        when(categoryRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Send update with only name — no parentId, clearParent=false
        var req = new CategoryController.UpdateRequest("Swiggy Renamed", null, null, false);
        var response = controller.update(principal, catId, req);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().parentId()).isEqualTo(existingParent.getId());
    }

    @Test
    void update_withClearParent_removesParent() {
        UUID catId = UUID.randomUUID();
        Category existingParent = Category.builder().id(UUID.randomUUID()).name("Food").system(true).build();
        Category cat = Category.builder().id(catId).name("Swiggy").color("#00f")
                .household(household).system(false).parent(existingParent).build();
        when(categoryRepository.findById(catId)).thenReturn(Optional.of(cat));
        when(categoryRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var req = new CategoryController.UpdateRequest(null, null, null, true);
        var response = controller.update(principal, catId, req);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().parentId()).isNull();
    }

    @Test
    void update_circularReference_throwsBadRequest() {
        UUID catId = UUID.randomUUID();
        UUID childId = UUID.randomUUID();
        Category cat = Category.builder().id(catId).name("Food").household(household).system(false).build();
        Category child = Category.builder().id(childId).name("Swiggy").household(household).system(false).parent(cat).build();
        when(categoryRepository.findById(catId)).thenReturn(Optional.of(cat));
        when(categoryRepository.findBySystemTrueOrHouseholdId(householdId))
                .thenReturn(List.of(cat, child));

        // Try to set Food's parent to its own child Swiggy — circular
        var req = new CategoryController.UpdateRequest(null, null, childId, false);
        var ex = assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> controller.update(principal, catId, req));
        assertThat(ex.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void list_returnsParentIdInResponse() {
        UUID parentId = UUID.randomUUID();
        Category parent = Category.builder().id(parentId).name("Food").color("#f00").system(true).build();
        Category child = Category.builder().id(UUID.randomUUID()).name("Swiggy").color("#00f")
                .system(false).household(household).parent(parent).build();
        when(categoryRepository.findBySystemTrueOrHouseholdId(householdId))
                .thenReturn(List.of(parent, child));

        var response = controller.list(principal);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        var childResponse = response.getBody().stream()
                .filter(r -> r.name().equals("Swiggy")).findFirst().orElseThrow();
        assertThat(childResponse.parentId()).isEqualTo(parentId);
    }
}
