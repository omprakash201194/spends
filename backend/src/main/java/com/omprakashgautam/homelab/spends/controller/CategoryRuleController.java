package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.CategoryRule;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
import com.omprakashgautam.homelab.spends.repository.CategoryRuleRepository;
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
@RequestMapping("/api/category-rules")
@RequiredArgsConstructor
public class CategoryRuleController {

    private final CategoryRuleRepository ruleRepository;
    private final CategoryRepository categoryRepository;
    private final UserRepository userRepository;

    public record RuleResponse(UUID id, String pattern, UUID categoryId, String categoryName,
                               String categoryColor, int priority) {
        public static RuleResponse from(CategoryRule r) {
            return new RuleResponse(
                    r.getId(), r.getPattern(),
                    r.getCategory().getId(), r.getCategory().getName(), r.getCategory().getColor(),
                    r.getPriority());
        }
    }

    public record CreateRequest(String pattern, UUID categoryId, int priority) {}
    public record UpdateRequest(String pattern, UUID categoryId, Integer priority) {}

    @GetMapping
    public ResponseEntity<List<RuleResponse>> list(@AuthenticationPrincipal UserDetailsImpl principal) {
        return ResponseEntity.ok(
                ruleRepository.listRulesForUser(principal.getId())
                        .stream().map(RuleResponse::from).toList());
    }

    @PostMapping
    public ResponseEntity<RuleResponse> create(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestBody CreateRequest req) {

        if (req.pattern() == null || req.pattern().isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "Pattern is required");
        }
        User user = resolveUser(principal);
        Category category = categoryRepository.findById(req.categoryId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Category not found"));

        CategoryRule saved = ruleRepository.save(CategoryRule.builder()
                .user(user)
                .pattern(req.pattern().trim().toLowerCase())
                .category(category)
                .priority(req.priority())
                .global(false)
                .build());

        return ResponseEntity.status(CREATED).body(RuleResponse.from(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<RuleResponse> update(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id,
            @RequestBody UpdateRequest req) {

        CategoryRule rule = ruleRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Rule not found"));

        if (rule.isGlobal() || rule.getUser() == null ||
                !rule.getUser().getId().equals(principal.getId())) {
            throw new ResponseStatusException(FORBIDDEN, "Cannot modify this rule");
        }
        if (req.pattern() != null && !req.pattern().isBlank()) {
            rule.setPattern(req.pattern().trim().toLowerCase());
        }
        if (req.categoryId() != null) {
            Category cat = categoryRepository.findById(req.categoryId())
                    .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Category not found"));
            rule.setCategory(cat);
        }
        if (req.priority() != null) {
            rule.setPriority(req.priority());
        }
        return ResponseEntity.ok(RuleResponse.from(ruleRepository.save(rule)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id) {

        CategoryRule rule = ruleRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Rule not found"));

        if (rule.isGlobal() || rule.getUser() == null ||
                !rule.getUser().getId().equals(principal.getId())) {
            throw new ResponseStatusException(FORBIDDEN, "Cannot delete this rule");
        }
        ruleRepository.delete(rule);
        return ResponseEntity.noContent().build();
    }

    private User resolveUser(UserDetailsImpl principal) {
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "User not found"));
    }
}
