package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.model.Category;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CategoryTreeUtilsTest {

    private Category cat(UUID id, UUID parentId) {
        Category c = new Category();
        c.setId(id);
        if (parentId != null) {
            Category parent = new Category();
            parent.setId(parentId);
            c.setParent(parent);
        }
        return c;
    }

    @Test
    void getDepth_rootCategory_returns0() {
        UUID id = UUID.randomUUID();
        Category root = cat(id, null);
        assertThat(CategoryTreeUtils.getDepth(root, List.of(root))).isEqualTo(0);
    }

    @Test
    void getDepth_childOfRoot_returns1() {
        UUID rootId = UUID.randomUUID();
        UUID childId = UUID.randomUUID();
        Category root  = cat(rootId, null);
        Category child = cat(childId, rootId);
        assertThat(CategoryTreeUtils.getDepth(child, List.of(root, child))).isEqualTo(1);
    }

    @Test
    void getDepth_grandchild_returns2() {
        UUID rootId = UUID.randomUUID();
        UUID midId  = UUID.randomUUID();
        UUID leafId = UUID.randomUUID();
        Category root = cat(rootId, null);
        Category mid  = cat(midId,  rootId);
        Category leaf = cat(leafId, midId);
        assertThat(CategoryTreeUtils.getDepth(leaf, List.of(root, mid, leaf))).isEqualTo(2);
    }

    @Test
    void getDescendantIds_returnsAllDescendants() {
        UUID rootId  = UUID.randomUUID();
        UUID child1  = UUID.randomUUID();
        UUID child2  = UUID.randomUUID();
        UUID grandch = UUID.randomUUID();
        Category root = cat(rootId,  null);
        Category c1   = cat(child1,  rootId);
        Category c2   = cat(child2,  rootId);
        Category gc   = cat(grandch, child1);
        List<Category> all = List.of(root, c1, c2, gc);

        Set<UUID> result = CategoryTreeUtils.getDescendantIds(rootId, all);
        assertThat(result).containsExactlyInAnyOrder(child1, child2, grandch);
        assertThat(result).doesNotContain(rootId);
    }

    @Test
    void getDescendantIds_leafCategory_returnsEmpty() {
        UUID id = UUID.randomUUID();
        Category leaf = cat(id, null);
        assertThat(CategoryTreeUtils.getDescendantIds(id, List.of(leaf))).isEmpty();
    }

    @Test
    void getAncestorIds_returnsParentAndGrandparent() {
        UUID rootId = UUID.randomUUID();
        UUID midId  = UUID.randomUUID();
        UUID leafId = UUID.randomUUID();
        Category root = cat(rootId, null);
        Category mid  = cat(midId,  rootId);
        Category leaf = cat(leafId, midId);
        List<UUID> ancestors = CategoryTreeUtils.getAncestorIds(leafId, List.of(root, mid, leaf));
        assertThat(ancestors).containsExactly(midId, rootId);
    }

    @Test
    void getAncestorIds_rootCategory_returnsEmpty() {
        UUID id = UUID.randomUUID();
        assertThat(CategoryTreeUtils.getAncestorIds(id, List.of(cat(id, null)))).isEmpty();
    }
}
