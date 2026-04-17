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
        when(categoryRepository.findById(parent.getId())).thenReturn(Optional.of(parent));
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
        when(categoryRepository.findById(parent.getId())).thenReturn(Optional.of(parent));
        when(categoryRepository.existsByNameAndHouseholdId(anyString(), any())).thenReturn(false);

        var req = new CategoryController.CreateRequest("Swiggy", "#00f", parent.getId());
        var ex = assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> controller.create(principal, req));
        assertThat(ex.getStatusCode().value()).isEqualTo(400);
        assertThat(ex.getReason()).contains("depth");
    }
}
