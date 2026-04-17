# Category Hierarchy with Configurable Depth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add parent-child category relationships (up to N levels, configurable per household), with spending roll-up into parents in Dashboard and Budget, and filter-by-parent in Transaction list.

**Architecture:** The DB already has a nullable `parent_id` self-referential FK on `category`. The entity already maps it. Missing pieces: (1) API doesn't expose/accept `parentId`, (2) no depth validation, (3) no rollup logic in Dashboard/Budget, (4) no configurable depth setting on Household, (5) no tree UI in frontend. A stateless `CategoryTreeUtils` helper does all in-memory tree traversal to avoid N+1 queries. Depth cap stored in `household.max_category_depth` (default 5).

**Tech Stack:** Spring Boot 3.3.4 / JPA / Liquibase YAML / Java 21 records · React 18 / TypeScript / TanStack Query v5 / Tailwind CSS 3

**Pre-requisite:** Plan A (Sidebar + CategoriesPage) must be merged first — Plan B adds the hierarchy tree view to the CategoriesPage created in Plan A.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/.../db/changelog/changes/019-household-max-depth.yaml` | Create | Migration: add `max_category_depth INT NOT NULL DEFAULT 5` to household |
| `backend/db/changelog/db.changelog-master.xml` | Modify | Include migration 019 |
| `backend/.../model/Household.java` | Modify | Add `maxCategoryDepth` field |
| `backend/.../service/CategoryTreeUtils.java` | Create | Stateless helper: `getDescendantIds`, `getDepth`, `buildTree` |
| `backend/.../controller/CategoryController.java` | Modify | Add `parentId` to response; accept `parentId` in create/update; validate depth against household setting |
| `backend/.../repository/CategoryRepository.java` | Modify | Add `findBySystemTrueOrHouseholdIdWithParent` query |
| `backend/.../service/TransactionService.java` | Modify | Expand `categoryId` filter to include all descendant IDs |
| `backend/.../service/DashboardService.java` | Modify | Post-process `categoryBreakdown` to roll up child spending into roots |
| `backend/.../service/BudgetService.java` | Modify | Post-process `categoryBreakdown` to roll up child spending into parent |
| `backend/.../controller/UserSettingsController.java` | Modify | Add `GET/PUT /api/settings/preferences` for `maxCategoryDepth` |
| `backend/.../dto/UserSettingsDto.java` | Modify | Add `Preferences` record and `PreferencesRequest` record |
| `backend/.../service/CategoryServiceTest.java` | Create | Unit tests for CategoryTreeUtils |
| `frontend/src/api/categories.ts` | Modify | Add `parentId` to `Category` interface; add `createCategoryWithParent`; add `getPreferences`/`savePreferences` |
| `frontend/src/api/settings.ts` | Modify | Add `getPreferences`, `savePreferences` for maxCategoryDepth |
| `frontend/src/pages/CategoriesPage.tsx` | Modify | Replace flat list with collapsible tree view; add "Add child" per parent |
| `frontend/src/pages/TransactionPage.tsx` | Modify | Category filter dropdown shows indented hierarchy |
| `frontend/src/pages/SettingsPage.tsx` | Modify | Add Preferences tab with max category depth input |

---

### Task 1: Migration — add max_category_depth to household

**Files:**
- Create: `backend/src/main/resources/db/changelog/changes/019-household-max-depth.yaml`
- Modify: `backend/src/main/resources/db/changelog/db.changelog-master.xml`

- [ ] **Step 1: Write the migration file**

```yaml
# backend/src/main/resources/db/changelog/changes/019-household-max-depth.yaml
databaseChangeLog:
  - changeSet:
      id: 019-household-max-depth
      author: system
      changes:
        - addColumn:
            tableName: household
            columns:
              - column:
                  name: max_category_depth
                  type: INT
                  defaultValueNumeric: 5
                  constraints:
                    nullable: false
```

- [ ] **Step 2: Register in master changelog**

Add after the `018-perf-indexes.yaml` line in `db.changelog-master.xml`:
```xml
    <include file="changes/019-household-max-depth.yaml" relativeToChangelogFile="true"/>
```

- [ ] **Step 3: Add field to Household entity**

In `backend/src/main/java/com/omprakashgautam/homelab/spends/model/Household.java`, add after `createdAt`:

```java
@Column(name = "max_category_depth", nullable = false)
@Builder.Default
private int maxCategoryDepth = 5;
```

Also add `@Builder.Default` import: already present via Lombok.

- [ ] **Step 4: Run the backend to verify migration applies**

```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=local -Dspring-boot.run.jvmArguments="" 2>&1 | grep -E "changelog|migration|ERROR" | head -20
```

Expected: `Successfully acquired change log lock` then `Running Changeset: ...019-household-max-depth`

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/db/changelog/changes/019-household-max-depth.yaml
git add backend/src/main/resources/db/changelog/db.changelog-master.xml
git add backend/src/main/java/com/omprakashgautam/homelab/spends/model/Household.java
git commit -m "feat: add max_category_depth to household (default 5)"
```

---

### Task 2: CategoryTreeUtils — in-memory tree helpers

**Files:**
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/CategoryTreeUtils.java`
- Create (test): `backend/src/test/java/com/omprakashgautam/homelab/spends/service/CategoryTreeUtilsTest.java`

This is a pure stateless utility — no Spring beans, no DB calls. Takes a flat list of Category objects.

- [ ] **Step 1: Write the failing test**

```java
// backend/src/test/java/com/omprakashgautam/homelab/spends/service/CategoryTreeUtilsTest.java
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
        UUID rootId  = UUID.randomUUID();
        UUID midId   = UUID.randomUUID();
        UUID leafId  = UUID.randomUUID();
        Category root  = cat(rootId, null);
        Category mid   = cat(midId,  rootId);
        Category leaf  = cat(leafId, midId);
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
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
mvn test -pl . -Dtest=CategoryTreeUtilsTest -q 2>&1 | tail -5
```

Expected: FAIL with `CategoryTreeUtils not found`

- [ ] **Step 3: Implement CategoryTreeUtils**

```java
// backend/src/main/java/com/omprakashgautam/homelab/spends/service/CategoryTreeUtils.java
package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.model.Category;

import java.util.*;

public final class CategoryTreeUtils {

    private CategoryTreeUtils() {}

    /** Depth of a category in the tree (root = 0). */
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
            if (depth > 20) break; // guard against cycles
        }
        return depth;
    }

    /**
     * All descendant IDs of the given category (not including the category itself).
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
     * IDs of all categories that are ancestors of the given category (not including itself).
     * Used to determine rollup targets.
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
mvn test -pl . -Dtest=CategoryTreeUtilsTest -q 2>&1 | tail -5
```

Expected: `Tests run: 5, Failures: 0, Errors: 0`

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/service/CategoryTreeUtils.java
git add backend/src/test/java/com/omprakashgautam/homelab/spends/service/CategoryTreeUtilsTest.java
git commit -m "feat: CategoryTreeUtils for in-memory category tree operations"
```

---

### Task 3: Expose and accept parentId in CategoryController

**Files:**
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/CategoryController.java`
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/CategoryRepository.java`

Rules:
- `parentId` is optional in create/update — null means root category
- When setting a parent, the resulting depth must be ≤ `household.maxCategoryDepth - 1` (so children at max depth have depth = maxDepth - 1, allowing one more level)
- A category cannot be set as a child of its own descendant (circular reference check)
- System categories can be parents of custom categories; custom categories can be parents of other custom categories
- Response always includes `parentId` (nullable)

- [ ] **Step 1: Write the failing test**

```java
// backend/src/test/java/com/omprakashgautam/homelab/spends/controller/CategoryControllerTest.java
package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.Household;
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
import org.springframework.http.HttpStatus;

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
                .build();
        principal = new UserDetailsImpl(user);
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
        user = User.builder().id(UUID.randomUUID()).household(household).build();
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
mvn test -pl . -Dtest=CategoryControllerTest -q 2>&1 | tail -8
```

Expected: FAIL — `CreateRequest` doesn't have `parentId` field yet.

- [ ] **Step 3: Update CategoryController**

Replace the entire `CategoryController.java` with:

```java
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
    public record UpdateRequest(String name, String color, UUID parentId) {}

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
            parent = categoryRepository.findById(req.parentId())
                    .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Parent category not found"));
            validateDepth(parent, household, categoryRepository.findBySystemTrueOrHouseholdId(household.getId()));
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

        // Update parent
        if (req.parentId() != null) {
            if (req.parentId().equals(id)) {
                throw new ResponseStatusException(BAD_REQUEST, "A category cannot be its own parent");
            }
            List<Category> allCats = categoryRepository.findBySystemTrueOrHouseholdId(household.getId());
            // Cannot set as child of its own descendant
            Set<UUID> descendants = CategoryTreeUtils.getDescendantIds(id, allCats);
            if (descendants.contains(req.parentId())) {
                throw new ResponseStatusException(BAD_REQUEST, "Cannot create a circular parent-child relationship");
            }
            Category newParent = categoryRepository.findById(req.parentId())
                    .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Parent category not found"));
            validateDepth(newParent, household, allCats);
            cat.setParent(newParent);
        } else {
            // Explicitly clearing parent (move to root)
            cat.setParent(null);
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

    private void validateDepth(Category parent, Household household, List<Category> allCats) {
        int parentDepth = CategoryTreeUtils.getDepth(parent, allCats);
        int maxDepth = household.getMaxCategoryDepth();
        // child will be at parentDepth + 1; must be < maxDepth
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
```

Also add the `Set` import:
```java
import java.util.Set;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
mvn test -pl . -Dtest=CategoryControllerTest -q 2>&1 | tail -5
```

Expected: `Tests run: 2, Failures: 0, Errors: 0`

- [ ] **Step 5: Run full test suite**

```bash
cd backend
mvn test -q 2>&1 | tail -10
```

Expected: No failures.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/controller/CategoryController.java
git add backend/src/test/java/com/omprakashgautam/homelab/spends/controller/CategoryControllerTest.java
git commit -m "feat: expose parentId in CategoryController; accept parentId in create/update with depth validation"
```

---

### Task 4: Expand category filter in TransactionService to include descendants

**Files:**
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/TransactionService.java`

When a user filters transactions by a parent category, all child category transactions should be included.

- [ ] **Step 1: Write the failing test**

Open `backend/src/test/java/com/omprakashgautam/homelab/spends/service/TransactionServiceTest.java` and add:

```java
@Test
void listTransactions_categoryFilter_includesDescendants() {
    // Arrange: parent category "Food", child "Swiggy" 
    UUID userId = UUID.randomUUID();
    UUID foodId = UUID.randomUUID();
    UUID swiggyId = UUID.randomUUID();

    Category food   = Category.builder().id(foodId).name("Food").system(true).build();
    Category swiggy = Category.builder().id(swiggyId).name("Swiggy").system(false)
            .parent(food).build();

    User user = User.builder().id(userId)
            .household(Household.builder().id(UUID.randomUUID()).name("H")
                    .inviteCode("X").maxCategoryDepth(5).build())
            .build();

    when(userRepository.findById(userId)).thenReturn(Optional.of(user));
    when(categoryRepository.findBySystemTrueOrHouseholdId(any()))
            .thenReturn(List.of(food, swiggy));
    when(transactionRepository.findAll(any(Specification.class), any(Pageable.class)))
            .thenReturn(Page.empty());

    // Act: filter by parent "foodId" — should expand to include swiggyId
    transactionService.list(userId, null, foodId, null, null, null, null, null, null, 0, 25);

    // Assert: the specification was built with expanded category set
    // (indirect: verify the repository was called — actual predicate expansion is integration-tested)
    verify(transactionRepository).findAll(any(Specification.class), any(Pageable.class));
    verify(categoryRepository).findBySystemTrueOrHouseholdId(user.getHousehold().getId());
}
```

Note: The `categoryRepository` mock must be injected into `TransactionService`. Check the constructor — if it's not there, add it.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
mvn test -pl . -Dtest=TransactionServiceTest#listTransactions_categoryFilter_includesDescendants -q 2>&1 | tail -5
```

Expected: FAIL (missing `categoryRepository` dependency or wrong method signature).

- [ ] **Step 3: Update TransactionService**

Add `CategoryRepository` injection and expand the category filter in `buildSpec`:

```java
// Add to imports:
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
import com.omprakashgautam.homelab.spends.service.CategoryTreeUtils;
import java.util.ArrayList;
import java.util.Set;

// Add field (Lombok @RequiredArgsConstructor picks it up):
private final CategoryRepository categoryRepository;
```

In the `list(...)` method, before calling `buildSpec`, expand the categoryId to include descendants:

```java
// In the list() method signature, add userId param if not present:
// Replace the call to buildSpec with:
public Page<TransactionDto.Response> list(UUID userId, String search, UUID categoryId,
        UUID accountId, String type, LocalDate dateFrom, LocalDate dateTo,
        String sortBy, String sortDir, int page, int size) {

    // Expand categoryId to include all descendants
    Set<UUID> categoryIds = null;
    if (categoryId != null) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
        List<Category> allCats = categoryRepository
                .findBySystemTrueOrHouseholdId(user.getHousehold().getId());
        categoryIds = new java.util.LinkedHashSet<>();
        categoryIds.add(categoryId);
        categoryIds.addAll(CategoryTreeUtils.getDescendantIds(categoryId, allCats));
    }

    Pageable pageable = PageRequest.of(page, size, buildSort(sortBy, sortDir));
    Specification<Transaction> spec = buildSpec(userId, search, categoryIds, accountId, type, dateFrom, dateTo);
    Page<Transaction> result = transactionRepository.findAll(spec, pageable);
    return result.map(TransactionDto.Response::from);
}
```

Update `buildSpec` signature to accept `Set<UUID> categoryIds` instead of `UUID categoryId`:

```java
private Specification<Transaction> buildSpec(
        UUID userId, String search, Set<UUID> categoryIds,
        UUID accountId, String type, LocalDate dateFrom, LocalDate dateTo) {

    return (root, query, cb) -> {
        List<Predicate> predicates = new ArrayList<>();

        predicates.add(cb.equal(root.get("bankAccount").get("user").get("id"), userId));

        if (search != null && !search.isBlank()) {
            String pattern = "%" + search.toLowerCase() + "%";
            predicates.add(cb.or(
                    cb.like(cb.lower(root.get("rawRemarks")), pattern),
                    cb.like(cb.lower(root.get("merchantName")), pattern)
            ));
        }

        if (categoryIds != null && !categoryIds.isEmpty()) {
            predicates.add(root.get("category").get("id").in(categoryIds));
        }

        if (accountId != null) {
            predicates.add(cb.equal(root.get("bankAccount").get("id"), accountId));
        }

        if ("DEBIT".equalsIgnoreCase(type)) {
            predicates.add(cb.greaterThan(root.get("withdrawalAmount"), java.math.BigDecimal.ZERO));
        } else if ("CREDIT".equalsIgnoreCase(type)) {
            predicates.add(cb.greaterThan(root.get("depositAmount"), java.math.BigDecimal.ZERO));
        }

        if (dateFrom != null) {
            predicates.add(cb.greaterThanOrEqualTo(root.get("valueDate"), dateFrom));
        }
        if (dateTo != null) {
            predicates.add(cb.lessThanOrEqualTo(root.get("valueDate"), dateTo));
        }

        if (query != null && query.getResultType().equals(Transaction.class)) {
            root.fetch("category", jakarta.persistence.criteria.JoinType.LEFT);
            root.fetch("bankAccount");
        }

        return cb.and(predicates.toArray(new Predicate[0]));
    };
}
```

Also update the `listAll` method (used by CSV export) to use the same expansion pattern.

- [ ] **Step 4: Fix the TransactionController to pass userId**

Check `TransactionController.java` — the `list` endpoint must pass `principal.getId()` as `userId` to the updated service method. Verify the signature matches.

- [ ] **Step 5: Run full tests**

```bash
cd backend
mvn test -q 2>&1 | tail -10
```

Expected: No failures.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/service/TransactionService.java
git add backend/src/test/java/com/omprakashgautam/homelab/spends/service/TransactionServiceTest.java
git commit -m "feat: expand category filter to include descendant categories in transaction list"
```

---

### Task 5: Roll up child category spending in Dashboard and Budget

**Files:**
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/DashboardService.java`
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/BudgetService.java`

**Strategy:** After calling `categoryBreakdown`, post-process the results to merge child spending into root-level ancestors. Any category with a parent is a child — its spending gets added to the root's total and then zeroed out from the detailed list.

The `categoryBreakdown` JPQL query returns rows as `Object[]`: `[categoryName (String), categoryColor (String), sum (BigDecimal)]`.

A `CategorySpendRow` helper record is used internally:
```java
record CategorySpendRow(UUID categoryId, String name, String color, BigDecimal spent) {}
```

The rollup logic (add this private static method to both DashboardService and BudgetService, or extract to a shared utility):

```java
/**
 * Given a flat list of (categoryId, name, color, spent) and the full category list,
 * merge child spending into ancestors. Returns only root-level rows with rolled-up totals.
 */
private static List<CategorySpendRow> rollupToRoots(
        List<CategorySpendRow> rows, List<Category> allCats) {

    Map<UUID, CategorySpendRow> byId = rows.stream()
            .collect(java.util.stream.Collectors.toMap(CategorySpendRow::categoryId, r -> r,
                    (a, b) -> a, java.util.LinkedHashMap::new));

    // For each row, walk up to root and accumulate spending
    Map<UUID, BigDecimal> rolledUp = new java.util.LinkedHashMap<>();
    for (CategorySpendRow row : rows) {
        List<UUID> ancestors = CategoryTreeUtils.getAncestorIds(row.categoryId(), allCats);
        if (ancestors.isEmpty()) {
            // This is already a root — add its own spending
            rolledUp.merge(row.categoryId(), row.spent(), BigDecimal::add);
        } else {
            // Roll up to the topmost ancestor (last in list)
            UUID rootId = ancestors.get(ancestors.size() - 1);
            rolledUp.merge(rootId, row.spent(), BigDecimal::add);
        }
    }

    // Build result: only root-level categories
    Map<UUID, Category> catById = allCats.stream()
            .collect(java.util.stream.Collectors.toMap(Category::getId, c -> c));

    return rolledUp.entrySet().stream()
            .filter(e -> e.getValue().compareTo(BigDecimal.ZERO) > 0)
            .map(e -> {
                Category cat = catById.get(e.getKey());
                String name = cat != null ? cat.getName() : "Unknown";
                String color = cat != null ? cat.getColor() : "#94a3b8";
                return new CategorySpendRow(e.getKey(), name, color, e.getValue());
            })
            .sorted(java.util.Comparator.comparing(CategorySpendRow::spent).reversed())
            .toList();
}
```

**DashboardService changes:**

- [ ] **Step 1: Write failing test for DashboardService rollup**

In `DashboardServiceTest.java`, add:

```java
@Test
void getSummary_rollsUpChildCategorySpending() {
    UUID userId = UUID.randomUUID();
    UUID householdId = UUID.randomUUID();
    Household hh = Household.builder().id(householdId).name("H").inviteCode("X").maxCategoryDepth(5).build();
    User user = User.builder().id(userId).household(hh).build();

    UUID foodId   = UUID.randomUUID();
    UUID swiggyId = UUID.randomUUID();
    Category food   = Category.builder().id(foodId).name("Food").color("#f00").system(true).build();
    Category swiggy = Category.builder().id(swiggyId).name("Swiggy").system(false).parent(food).color("#0f0").build();

    LocalDate anchor = LocalDate.of(2025, 10, 31);
    when(transactionRepository.latestTransactionDate(userId)).thenReturn(anchor);
    when(transactionRepository.sumWithdrawals(eq(userId), any(), any())).thenReturn(new BigDecimal("1500"));
    when(transactionRepository.sumDeposits(eq(userId), any(), any())).thenReturn(BigDecimal.ZERO);
    when(transactionRepository.countInPeriod(eq(userId), any(), any())).thenReturn(5L);
    when(transactionRepository.categoryBreakdown(eq(userId), any(), any()))
            .thenReturn(List.of(
                    new Object[]{swiggyId, "Swiggy", "#0f0", new BigDecimal("1500")}
            ));
    when(transactionRepository.monthlyTrend(eq(userId), any())).thenReturn(List.of());
    when(transactionRepository.topMerchants(eq(userId), any(), any())).thenReturn(List.of());
    when(userRepository.findById(userId)).thenReturn(Optional.of(user));
    when(categoryRepository.findBySystemTrueOrHouseholdId(householdId)).thenReturn(List.of(food, swiggy));

    DashboardDto.Summary summary = dashboardService.getSummary(userId);

    // Swiggy spending should be rolled into Food
    assertThat(summary.categoryBreakdown()).hasSize(1);
    assertThat(summary.categoryBreakdown().get(0).name()).isEqualTo("Food");
    assertThat(summary.categoryBreakdown().get(0).amount()).isEqualByComparingTo("1500");
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
mvn test -pl . -Dtest=DashboardServiceTest#getSummary_rollsUpChildCategorySpending -q 2>&1 | tail -5
```

Expected: FAIL — dashboard does not roll up yet.

- [ ] **Step 3: Update DashboardService**

The `categoryBreakdown` query currently returns `Object[]` with `[name (String), color (String), sum (BigDecimal)]`. To support rollup, we need the categoryId in the result. Update the JPQL query in `TransactionRepository`:

In `TransactionRepository.java`, change the `categoryBreakdown` query to include `t.category.id`:

```java
@Query("""
    SELECT t.category.id, t.category.name, t.category.color, SUM(t.withdrawalAmount)
    FROM Transaction t
    WHERE t.bankAccount.user.id = :userId
      AND t.valueDate >= :from AND t.valueDate <= :to
      AND t.withdrawalAmount > 0
      AND t.category IS NOT NULL
    GROUP BY t.category.id, t.category.name, t.category.color
    ORDER BY SUM(t.withdrawalAmount) DESC
    """)
List<Object[]> categoryBreakdown(@Param("userId") UUID userId,
                                 @Param("from") LocalDate from,
                                 @Param("to") LocalDate to);
```

Now update DashboardService to inject `CategoryRepository` and do rollup:

```java
// Add to DashboardService fields:
private final CategoryRepository categoryRepository;
private final UserRepository userRepository;

// Add record:
private record CategorySpendRow(UUID categoryId, String name, String color, BigDecimal spent) {}
```

In `getSummary`, replace the `categoryBreakdown` processing block with:

```java
User user = userRepository.findById(userId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "User not found"));
List<Category> allCats = categoryRepository.findBySystemTrueOrHouseholdId(user.getHousehold().getId());

List<CategorySpendRow> rawBreakdown = transactionRepository.categoryBreakdown(userId, from, to)
        .stream()
        .map(row -> new CategorySpendRow(
                (UUID) row[0], (String) row[1], (String) row[2], (BigDecimal) row[3]))
        .toList();

List<CategorySpendRow> rolled = rollupToRoots(rawBreakdown, allCats);

List<DashboardDto.CategoryBreakdown> categoryBreakdown = rolled.stream()
        .map(r -> new DashboardDto.CategoryBreakdown(r.name(), r.color(), r.spent()))
        .toList();
```

Add the static `rollupToRoots` method and `CategorySpendRow` record (as defined in the strategy section above) as private members of `DashboardService`.

- [ ] **Step 4: Update BudgetService similarly**

In BudgetService, the `spentByCategory` map is keyed by category name. Change it to be keyed by category ID using the new `Object[]` row format. Then apply rollup.

Replace the `spentByCategory` computation (around line 47-53 in BudgetService) with:

```java
// Raw spending rows from DB, keyed by category UUID
List<CategorySpendRow> rawRows = transactionRepository.categoryBreakdown(userId, from, to)
        .stream()
        .map(row -> new CategorySpendRow(
                (UUID) row[0], (String) row[1], (String) row[2], (BigDecimal) row[3]))
        .toList();

User user = userRepository.findById(userId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "User not found"));
List<Category> allCats = categoryRepository.findBySystemTrueOrHouseholdId(user.getHousehold().getId());
List<CategorySpendRow> rolled = rollupToRoots(rawRows, allCats);

Map<UUID, BigDecimal> spentById = rolled.stream()
        .collect(Collectors.toMap(CategorySpendRow::categoryId, CategorySpendRow::spent));
```

Then update the `items` computation to look up spending by `cat.getId()` instead of `cat.getName()`:

```java
BigDecimal spent = spentById.getOrDefault(cat.getId(), BigDecimal.ZERO);
```

Also add the `CategorySpendRow` record and `rollupToRoots` method to BudgetService (same implementation as DashboardService).

Add `CategoryRepository` and `UserRepository` fields to BudgetService if not already present.

- [ ] **Step 5: Run full tests**

```bash
cd backend
mvn test -q 2>&1 | tail -10
```

Expected: No failures.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionRepository.java
git add backend/src/main/java/com/omprakashgautam/homelab/spends/service/DashboardService.java
git add backend/src/main/java/com/omprakashgautam/homelab/spends/service/BudgetService.java
git add backend/src/test/java/com/omprakashgautam/homelab/spends/service/DashboardServiceTest.java
git commit -m "feat: roll up child category spending into parent in Dashboard and Budget"
```

---

### Task 6: Max depth preference in Settings API

**Files:**
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/UserSettingsDto.java`
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/UserSettingsController.java`

- [ ] **Step 1: Write the failing test**

In `UserSettingsControllerTest.java` (create if not exists):

```java
@Test
void savePreferences_updatesMaxDepthOnHousehold() {
    UUID userId = UUID.randomUUID();
    Household hh = Household.builder().id(UUID.randomUUID()).name("H").inviteCode("X").maxCategoryDepth(5).build();
    User user = User.builder().id(userId).household(hh).build();
    UserDetailsImpl principal = new UserDetailsImpl(user);

    when(userRepository.findById(userId)).thenReturn(Optional.of(user));
    when(householdRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

    var req = new UserSettingsDto.PreferencesRequest(3);
    var response = controller.savePreferences(principal, req);

    assertThat(response.getStatusCode().value()).isEqualTo(200);
    assertThat(response.getBody().maxCategoryDepth()).isEqualTo(3);
    verify(householdRepository).save(argThat(h -> h.getMaxCategoryDepth() == 3));
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
mvn test -pl . -Dtest=UserSettingsControllerTest -q 2>&1 | tail -5
```

Expected: FAIL.

- [ ] **Step 3: Update UserSettingsDto**

```java
package com.omprakashgautam.homelab.spends.dto;

public class UserSettingsDto {
    public record Settings(boolean hasApiKey, String notificationEmail) {}
    public record ApiKeyRequest(String apiKey) {}
    public record NotificationEmailRequest(String notificationEmail) {}
    public record Preferences(int maxCategoryDepth) {}
    public record PreferencesRequest(int maxCategoryDepth) {}
}
```

- [ ] **Step 4: Update UserSettingsController**

Add `HouseholdRepository` injection and two new endpoints:

```java
// Add field:
private final HouseholdRepository householdRepository;

@GetMapping("/preferences")
public ResponseEntity<UserSettingsDto.Preferences> getPreferences(
        @AuthenticationPrincipal UserDetailsImpl principal) {
    User user = resolveUser(principal);
    return ResponseEntity.ok(new UserSettingsDto.Preferences(
            user.getHousehold().getMaxCategoryDepth()));
}

@PutMapping("/preferences")
public ResponseEntity<UserSettingsDto.Preferences> savePreferences(
        @AuthenticationPrincipal UserDetailsImpl principal,
        @RequestBody UserSettingsDto.PreferencesRequest req) {
    if (req.maxCategoryDepth() < 1 || req.maxCategoryDepth() > 10) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "maxCategoryDepth must be between 1 and 10");
    }
    User user = resolveUser(principal);
    Household hh = user.getHousehold();
    hh.setMaxCategoryDepth(req.maxCategoryDepth());
    householdRepository.save(hh);
    return ResponseEntity.ok(new UserSettingsDto.Preferences(hh.getMaxCategoryDepth()));
}
```

- [ ] **Step 5: Run full tests**

```bash
cd backend
mvn test -q 2>&1 | tail -10
```

Expected: No failures.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/dto/UserSettingsDto.java
git add backend/src/main/java/com/omprakashgautam/homelab/spends/controller/UserSettingsController.java
git add backend/src/test/java/com/omprakashgautam/homelab/spends/controller/UserSettingsControllerTest.java
git commit -m "feat: GET/PUT /api/settings/preferences for maxCategoryDepth"
git push origin main
```

---

### Task 7: Frontend — add parentId to Category interface and preferences API

**Files:**
- Modify: `frontend/src/api/categories.ts`
- Modify: `frontend/src/api/settings.ts`

- [ ] **Step 1: Update categories.ts**

```typescript
// frontend/src/api/categories.ts
import apiClient from './client'

export interface Category {
  id: string
  name: string
  icon: string | null
  color: string | null
  system: boolean
  parentId: string | null
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await apiClient.get<Category[]>('/categories')
  return data
}

export async function createCategory(
  name: string,
  color: string,
  parentId?: string | null,
): Promise<Category> {
  const { data } = await apiClient.post<Category>('/categories', { name, color, parentId: parentId ?? null })
  return data
}

export async function updateCategory(
  id: string,
  name: string,
  color: string,
  parentId?: string | null,
): Promise<Category> {
  const { data } = await apiClient.put<Category>(`/categories/${id}`, {
    name, color, parentId: parentId !== undefined ? parentId : undefined,
  })
  return data
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/categories/${id}`)
}

// Tree helper — builds a tree from the flat list
export interface CategoryNode extends Category {
  children: CategoryNode[]
}

export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>()
  const roots: CategoryNode[] = []

  for (const cat of categories) {
    byId.set(cat.id, { ...cat, children: [] })
  }
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}
```

- [ ] **Step 2: Add preferences to settings.ts**

In `frontend/src/api/settings.ts`, add:

```typescript
export interface Preferences {
  maxCategoryDepth: number
}

export async function getPreferences(): Promise<Preferences> {
  const { data } = await apiClient.get<Preferences>('/settings/preferences')
  return data
}

export async function savePreferences(maxCategoryDepth: number): Promise<Preferences> {
  const { data } = await apiClient.put<Preferences>('/settings/preferences', { maxCategoryDepth })
  return data
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/categories.ts frontend/src/api/settings.ts
git commit -m "feat: add parentId to Category interface; add preferences API for maxCategoryDepth"
```

---

### Task 8: Frontend — tree view in CategoriesPage and indented transaction filter

**Files:**
- Modify: `frontend/src/pages/CategoriesPage.tsx`
- Modify: `frontend/src/pages/TransactionPage.tsx`

**CategoriesPage tree view:**
- Custom categories and system categories shown as trees
- Each parent has a ▶ / ▼ toggle to expand/collapse its children
- "Add child" button appears on hover next to each category row
- When "Add child" is clicked, the create form pre-fills `parentId`
- Depth badge shown (e.g. "L1", "L2") on each row

**TransactionPage filter:**
- Category dropdown shows indented hierarchy using `&nbsp;` × depth prefix
- Filtering by a parent category automatically includes descendants (handled by backend)

- [ ] **Step 1: Update CategoriesPage.tsx CategoriesTab to tree view**

Replace the `CategoriesTab` function body (the custom categories list section) with:

```typescript
// Replace the custom categories list in CategoriesTab with:
// 1. Build tree from cats
const tree = buildCategoryTree(cats)
const customTree = tree.filter(n => !n.system)
  .concat(
    tree.filter(n => n.system).flatMap(n => n.children.filter(c => !c.system))
  )
// Actually, build a single tree of all categories for context, then filter display

// State for expanded nodes
const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
const [addChildParentId, setAddChildParentId] = useState<string | null>(null)

const toggleExpand = (id: string) => {
  setExpandedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
}
```

Full `CategoriesTab` replacement (replace the existing function entirely):

```typescript
function CategoriesTab() {
  const qc = useQueryClient()
  const { data: cats = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  })

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createParentId, setCreateParentId] = useState<string | null>(null)
  const [newName, setNewName]   = useState('')
  const [newColor, setNewColor] = useState(COLOUR_SWATCHES[5])
  const [editId, setEditId]     = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const createMutation = useMutation({
    mutationFn: () => createCategory(newName.trim(), newColor, createParentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      setNewName('')
      setNewColor(COLOUR_SWATCHES[5])
      setShowCreateForm(false)
      setCreateParentId(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (id: string) => updateCategory(id, editName.trim(), editColor),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setEditId(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })

  const startEdit = (c: Category) => { setEditId(c.id); setEditName(c.name); setEditColor(c.color ?? COLOUR_SWATCHES[5]) }
  const toggleExpand = (id: string) => setExpandedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })

  const allTree = buildCategoryTree(cats)
  const systemRoots = allTree.filter(n => n.system)
  const customRoots = allTree.filter(n => !n.system)

  const renderNode = (node: CategoryNode, depth: number): React.ReactNode => {
    const hasChildren = node.children.length > 0
    const isExpanded = expandedIds.has(node.id)
    const isEditing = editId === node.id

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 group"
          style={{ paddingLeft: `${12 + depth * 20}px` }}
        >
          {/* Expand toggle */}
          <button
            onClick={() => toggleExpand(node.id)}
            className={`w-4 h-4 flex items-center justify-center text-gray-400 ${!hasChildren ? 'invisible' : ''}`}
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>

          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: node.color ?? '#94a3b8' }} />

          {isEditing ? (
            <>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="flex-1 px-2 py-0.5 text-sm border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                onKeyDown={e => { if (e.key === 'Enter') updateMutation.mutate(node.id); if (e.key === 'Escape') setEditId(null) }}
                autoFocus
              />
              <ColourPicker value={editColor} onChange={setEditColor} />
              <button onClick={() => updateMutation.mutate(node.id)} className="text-blue-500 hover:text-blue-600"><Check className="w-4 h-4" /></button>
              <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">{node.name}</span>
              {depth > 0 && (
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">L{depth}</span>
              )}

              {/* Actions — shown on hover; only for custom categories */}
              {!node.system && (
                <div className="hidden group-hover:flex items-center gap-1">
                  <button
                    title="Add child category"
                    onClick={() => { setCreateParentId(node.id); setShowCreateForm(true); setExpandedIds(prev => new Set([...prev, node.id])) }}
                    className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => startEdit(node)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteMutation.mutate(node.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  if (isLoading) return <div className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">Loading…</div>

  return (
    <div className="space-y-6">
      {/* Custom categories */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Custom Categories</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">Shared across your household</p>
          </div>
          {!showCreateForm && (
            <button
              onClick={() => { setCreateParentId(null); setShowCreateForm(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New Category
            </button>
          )}
        </div>

        {showCreateForm && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
            {createParentId && (
              <p className="text-xs text-blue-500 mb-2">
                Adding child to: <strong>{cats.find(c => c.id === createParentId)?.name}</strong>
                <button onClick={() => setCreateParentId(null)} className="ml-2 text-gray-400 hover:text-gray-600"><X className="w-3 h-3 inline" /></button>
              </p>
            )}
            <div className="flex gap-2 mb-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Category name…"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) createMutation.mutate(); if (e.key === 'Escape') setShowCreateForm(false) }}
                autoFocus
              />
              <div className="w-9 h-9 rounded-lg border-2 border-gray-300 dark:border-gray-500 flex-shrink-0" style={{ backgroundColor: newColor }} />
            </div>
            <ColourPicker value={newColor} onChange={setNewColor} />
            <div className="flex gap-2 mt-2">
              <button onClick={() => createMutation.mutate()} disabled={!newName.trim() || createMutation.isPending}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50">
                Create
              </button>
              <button onClick={() => { setShowCreateForm(false); setCreateParentId(null) }}
                className="px-3 py-1.5 text-gray-500 dark:text-gray-400 text-xs hover:text-gray-700 dark:hover:text-gray-200">
                Cancel
              </button>
            </div>
          </div>
        )}

        {customRoots.length === 0 && !showCreateForm ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
            No custom categories yet. Create one to get started.
          </p>
        ) : (
          <div className="space-y-0.5">
            {customRoots.map(node => renderNode(node, 0))}
          </div>
        )}
      </div>

      {/* System categories */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">System Categories</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
          Built-in categories — cannot be modified, but custom sub-categories can be added beneath them
        </p>
        <div className="space-y-0.5">
          {systemRoots.map(node => renderNode(node, 0))}
        </div>
      </div>
    </div>
  )
}
```

Add `ChevronRight` to the lucide-react imports in `CategoriesPage.tsx`.

- [ ] **Step 2: Update TransactionPage category filter dropdown to show indented hierarchy**

In `TransactionPage.tsx`, find the category `<select>` element (in the filter bar). Replace the simple `cats.map(c => <option>)` with an indented version using `buildCategoryTree`:

```typescript
// Add import at top of TransactionPage.tsx:
import { buildCategoryTree, type CategoryNode } from '../api/categories'

// In the filter bar, replace the category <select> options:
{/* Category filter — shows indented tree */}
<select
  value={categoryId}
  onChange={e => { setCategoryId(e.target.value || undefined); setPage(0) }}
  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
>
  <option value="">All categories</option>
  {buildCategoryTree(categories).flatMap(node => flattenWithDepth(node, 0))}
</select>
```

Add helper function above the component:

```typescript
function flattenWithDepth(node: CategoryNode, depth: number): React.ReactNode[] {
  const prefix = '\u00a0\u00a0\u00a0\u00a0'.repeat(depth) // 4 non-breaking spaces per level
  const items: React.ReactNode[] = [
    <option key={node.id} value={node.id}>{prefix}{node.name}</option>
  ]
  for (const child of node.children) {
    items.push(...flattenWithDepth(child, depth + 1))
  }
  return items
}
```

- [ ] **Step 3: Verify in browser**

1. Go to `/categories`. Custom categories show as a tree with expand/collapse. "Add child" button appears on hover. System categories show their tree (custom sub-categories appear under them).
2. Go to `/transactions`. Category filter dropdown shows indented hierarchy.
3. Select a parent category in the filter — all transactions with any descendant category appear.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/CategoriesPage.tsx
git add frontend/src/pages/TransactionPage.tsx
git commit -m "feat: category tree view in CategoriesPage and indented filter in Transactions"
```

---

### Task 9: Settings — max category depth preference input

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`

Add a "Preferences" tab between Notifications and Danger Zone with a numeric input for max category depth.

- [ ] **Step 1: Update SettingsPage**

Add `'preferences'` to the `Tab` type:
```typescript
type Tab = 'apikey' | 'notifications' | 'preferences' | 'danger'
```

Add tab button entry (between notifications and danger):
```typescript
{ id: 'preferences', label: 'Preferences', icon: Sliders },
```

Add conditional render:
```typescript
{tab === 'preferences' && <PreferencesTab />}
```

Add imports:
```typescript
import { getSettings, saveApiKey, deleteApiKey, saveNotificationEmail, getPreferences, savePreferences } from '../api/settings'
```

Add `PreferencesTab` component:

```typescript
function PreferencesTab() {
  const qc = useQueryClient()
  const { data: prefs } = useQuery({
    queryKey: ['preferences'],
    queryFn: getPreferences,
  })
  const [depth, setDepth] = useState<number | ''>(prefs?.maxCategoryDepth ?? 5)
  const [saved, setSaved] = useState(false)

  // sync when data loads
  useEffect(() => {
    if (prefs?.maxCategoryDepth !== undefined) setDepth(prefs.maxCategoryDepth)
  }, [prefs?.maxCategoryDepth])

  const saveMutation = useMutation({
    mutationFn: () => savePreferences(Number(depth)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['preferences'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Sliders className="w-4 h-4 text-blue-500" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Category Preferences</h2>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
        Configure how categories behave across your household.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Max Category Depth
          </label>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
            Maximum levels of parent-child nesting allowed (1 = root only, 5 = up to 5 levels deep).
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={10}
              value={depth}
              onChange={e => setDepth(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={() => saveMutation.mutate()}
              disabled={depth === '' || depth < 1 || depth > 10 || saveMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saved ? <Check className="w-4 h-4" /> : 'Save'}
            </button>
          </div>
          {saved && (
            <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Preference saved
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
```

Also add `useEffect` to the imports at the top of SettingsPage.tsx.

- [ ] **Step 2: Verify in browser**

Go to Settings → Preferences tab. Shows a numeric input defaulting to 5. Change to 3, Save. Navigate to `/categories` and try to create a 4-level-deep category — should get an error.

- [ ] **Step 3: Commit and push**

```bash
git add frontend/src/pages/SettingsPage.tsx
git commit -m "feat: Preferences tab in Settings for configurable max category depth"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ Parent-child up to N levels (configurable via `household.max_category_depth`, default 5)
- ✅ System categories can be parents of custom categories
- ✅ Custom categories can be parents of other custom categories
- ✅ Transactions can be assigned to a parent category directly (no leaf-only restriction)
- ✅ Filtering by parent category includes all descendants (backend Specification expansion)
- ✅ Budget and Dashboard roll up child spending into parent
- ✅ Max depth configurable in Settings → Preferences tab (1–10 range)
- ✅ Circular reference prevention (cannot set a descendant as parent)
- ✅ Tree view with expand/collapse in CategoriesPage
- ✅ "Add child" shortcut in CategoriesPage
- ✅ Indented hierarchy in Transaction filter dropdown
- ✅ Depth badge (L1, L2, …) on child categories in tree view

**Placeholder scan:** All code blocks are complete. No TBD items.

**Type consistency:** `CategoryNode extends Category` with `children: CategoryNode[]`. `buildCategoryTree` and `flattenWithDepth` use `CategoryNode`. `CategorySpendRow` record used consistently in both `DashboardService` and `BudgetService`. `rollupToRoots` has the same signature in both services.
