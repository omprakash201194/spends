package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.model.Category;

import java.util.*;

public final class CategoryTreeUtils {

    private CategoryTreeUtils() {}

    /** Depth of a category in the tree (root = 0). Max guard at 20 to prevent infinite loops. */
    public static int getDepth(Category category, List<Category> allCategories) {
        Map<UUID, UUID> parentOf = new HashMap<>();
        for (Category c : allCategories) {
            if (c.getParent() != null) {
                parentOf.put(c.getId(), c.getParent().getId());
            }
        }
        int depth = 0;
        UUID current = category.getId();
        while (parentOf.containsKey(current)) {
            current = parentOf.get(current);
            depth++;
            if (depth > 20) break;
        }
        return depth;
    }

    /**
     * All descendant IDs of the given category (NOT including the category itself).
     * BFS over the flat list.
     */
    public static Set<UUID> getDescendantIds(UUID categoryId, List<Category> allCategories) {
        Map<UUID, List<UUID>> children = new HashMap<>();
        for (Category c : allCategories) {
            if (c.getParent() != null) {
                children.computeIfAbsent(c.getParent().getId(), k -> new ArrayList<>())
                        .add(c.getId());
            }
        }
        Set<UUID> result = new LinkedHashSet<>();
        Queue<UUID> queue = new ArrayDeque<>(children.getOrDefault(categoryId, List.of()));
        while (!queue.isEmpty()) {
            UUID id = queue.poll();
            result.add(id);
            queue.addAll(children.getOrDefault(id, List.of()));
        }
        return result;
    }

    /**
     * IDs of all ancestors of the given category, from immediate parent to root (not including itself).
     */
    public static List<UUID> getAncestorIds(UUID categoryId, List<Category> allCategories) {
        Map<UUID, UUID> parentOf = new HashMap<>();
        for (Category c : allCategories) {
            if (c.getParent() != null) {
                parentOf.put(c.getId(), c.getParent().getId());
            }
        }
        List<UUID> ancestors = new ArrayList<>();
        UUID current = parentOf.get(categoryId);
        int guard = 0;
        while (current != null && guard++ < 20) {
            ancestors.add(current);
            current = parentOf.get(current);
        }
        return ancestors;
    }
}
