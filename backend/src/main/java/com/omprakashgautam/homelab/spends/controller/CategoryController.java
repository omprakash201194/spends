package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.Household;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryRepository categoryRepository;
    private final UserRepository userRepository;

    public record CategoryResponse(UUID id, String name, String icon, String color, boolean system) {
        public static CategoryResponse from(Category c) {
            return new CategoryResponse(c.getId(), c.getName(), c.getIcon(), c.getColor(), c.isSystem());
        }
    }

    public record CreateRequest(String name, String color) {}
    public record UpdateRequest(String name, String color) {}

    /** System categories + this household's custom categories. */
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

        Category saved = categoryRepository.save(Category.builder()
                .name(req.name().trim())
                .color(req.color() != null ? req.color().trim() : "#94a3b8")
                .household(household)
                .system(false)
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
        UUID householdId = resolveHouseholdId(principal);
        if (!householdId.equals(cat.getHousehold().getId())) {
            throw new ResponseStatusException(FORBIDDEN, "Not your category");
        }
        if (req.name() != null && !req.name().isBlank()) {
            cat.setName(req.name().trim());
        }
        if (req.color() != null && !req.color().isBlank()) {
            cat.setColor(req.color().trim());
        }
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

    private User resolveUser(UserDetailsImpl principal) {
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "User not found"));
    }

    private UUID resolveHouseholdId(UserDetailsImpl principal) {
        return resolveUser(principal).getHousehold().getId();
    }
}
