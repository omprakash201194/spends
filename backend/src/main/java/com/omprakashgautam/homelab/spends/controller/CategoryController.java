package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryRepository categoryRepository;

    public record CategoryResponse(UUID id, String name, String icon, String color, boolean system) {
        public static CategoryResponse from(Category c) {
            return new CategoryResponse(c.getId(), c.getName(), c.getIcon(), c.getColor(), c.isSystem());
        }
    }

    @GetMapping
    public ResponseEntity<List<CategoryResponse>> list() {
        return ResponseEntity.ok(
                categoryRepository.findAll()
                        .stream()
                        .map(CategoryResponse::from)
                        .toList()
        );
    }
}
