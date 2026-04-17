package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.Household;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.CategoryTreeUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryRepository categoryRepository;
    private final UserRepository userRepository;

    public record CategoryResponse(UUID id, String name, String icon, String color, boolean system, UUID parentId) {
        public static CategoryResponse from(Category c) {
            return new CategoryResponse(
                    c.getId(), c.getName(), c.getIcon(), c.getColor(), c.isSystem(),
                    c.getParent() != null ? c.getParent().getId() : null
            );
        }
    }

    public record CreateRequest(String name, String color, UUID parentId) {}
    public record UpdateRequest(String name, String color, UUID parentId, boolean clearParent) {}

    @GetMapping
    public ResponseEntity<List<CategoryResponse>> list(@AuthenticationPrincipal UserDetailsImpl principal) {
        UUID householdId = resolveHouseholdId(principal);
        return ResponseEntity.ok(
                categoryRepository.findBySystemTrueOrHouseholdId(householdId)
                        .stream()
                        .map(CategoryResponse::from)
                        .toList()
        );
    }

    @PostMapping
    public ResponseEntity<CategoryResponse> create(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestBody CreateRequest req) {

        if (req.name() == null || req.name().isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "Name is required");
        }
        User user = resolveUser(principal);
        Household household = user.getHousehold();

        if (categoryRepository.existsByNameAndHouseholdId(req.name().trim(), household.getId())) {
            throw new ResponseStatusException(CONFLICT, "A category with this name already exists");
        }

        Category parent = null;
        if (req.parentId() != null) {
            List<Category> allCats = categoryRepository.findBySystemTrueOrHouseholdId(household.getId());
            parent = allCats.stream()
                    .filter(c -> c.getId().equals(req.parentId()))
                    .findFirst()
                    .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Parent category not found"));
            validateDepth(parent, household, allCats);
        }

        Category saved = categoryRepository.save(Category.builder()
                .name(req.name().trim())
                .color(req.color() != null ? req.color().trim() : "#94a3b8")
                .household(household)
                .system(false)
                .parent(parent)
                .build());

        return ResponseEntity.status(CREATED).body(CategoryResponse.from(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CategoryResponse> update(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id,
            @RequestBody UpdateRequest req) {

        Category cat = categoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Category not found"));

        if (cat.isSystem()) {
            throw new ResponseStatusException(FORBIDDEN, "System categories cannot be modified");
        }
        User user = resolveUser(principal);
        Household household = user.getHousehold();
        if (!household.getId().equals(cat.getHousehold().getId())) {
            throw new ResponseStatusException(FORBIDDEN, "Not your category");
        }

        if (req.name() != null && !req.name().isBlank()) {
            cat.setName(req.name().trim());
        }
        if (req.color() != null && !req.color().isBlank()) {
            cat.setColor(req.color().trim());
        }

        if (req.parentId() != null) {
            if (req.parentId().equals(id)) {
                throw new ResponseStatusException(BAD_REQUEST, "A category cannot be its own parent");
            }
            List<Category> allCats = categoryRepository.findBySystemTrueOrHouseholdId(household.getId());
            Set<UUID> descendants = CategoryTreeUtils.getDescendantIds(id, allCats);
            if (descendants.contains(req.parentId())) {
                throw new ResponseStatusException(BAD_REQUEST, "Cannot create a circular parent-child relationship");
            }
            Category newParent = categoryRepository.findById(req.parentId())
                    .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Parent category not found"));
            validateDepth(newParent, household, allCats);
            cat.setParent(newParent);
        } else if (req.clearParent()) {
            cat.setParent(null);
        }
        // else: null parentId + clearParent=false → leave parent unchanged

        return ResponseEntity.ok(CategoryResponse.from(categoryRepository.save(cat)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id) {

        Category cat = categoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Category not found"));

        if (cat.isSystem()) {
            throw new ResponseStatusException(FORBIDDEN, "System categories cannot be deleted");
        }
        UUID householdId = resolveHouseholdId(principal);
        if (!householdId.equals(cat.getHousehold().getId())) {
            throw new ResponseStatusException(FORBIDDEN, "Not your category");
        }
        categoryRepository.delete(cat);
        return ResponseEntity.noContent().build();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private void validateDepth(Category parent, Household household, List<Category> allCats) {
        int parentDepth = CategoryTreeUtils.getDepth(parent, allCats);
        int maxDepth = household.getMaxCategoryDepth();
        if (parentDepth + 1 >= maxDepth) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "Maximum category depth of " + maxDepth + " would be exceeded");
        }
    }

    private User resolveUser(UserDetailsImpl principal) {
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "User not found"));
    }

    private UUID resolveHouseholdId(UserDetailsImpl principal) {
        return resolveUser(principal).getHousehold().getId();
    }
}
