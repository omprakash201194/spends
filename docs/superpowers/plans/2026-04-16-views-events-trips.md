# Phase 11: Views (Events / Trips) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add household-wide spend views for trips/events with date-range auto-tagging, manual transaction management, and List/Board/Summary sub-views.

**Architecture:** A `spend_view` table scoped to a household links to transactions via a `view_transaction` join table (many-to-many). Views are created with a date range that auto-tags matching household transactions. Users can then manually add/remove transactions. Three frontend sub-views (List, Board, Summary) display the data differently. A new "Views" nav entry and a "Add to view" action on the Transactions page complete the feature.

**Tech Stack:** Spring Boot 3.3.4 / Java 21 / JPA / Liquibase (backend) · React 18 / TypeScript / TanStack Query / Tailwind / Recharts (frontend)

---

## File Map

**Backend — new files**
- `backend/src/main/resources/db/changelog/changes/007-views-schema.sql`
- `backend/src/main/java/.../model/ViewType.java`
- `backend/src/main/java/.../model/SpendView.java`
- `backend/src/main/java/.../model/ViewTransactionLink.java`
- `backend/src/main/java/.../model/ViewCategoryBudget.java`
- `backend/src/main/java/.../dto/ViewDto.java`
- `backend/src/main/java/.../repository/ViewRepository.java`
- `backend/src/main/java/.../repository/ViewTransactionLinkRepository.java`
- `backend/src/main/java/.../repository/ViewCategoryBudgetRepository.java`
- `backend/src/main/java/.../service/ViewService.java`
- `backend/src/main/java/.../controller/ViewController.java`

**Backend — modified files**
- `backend/src/main/resources/db/changelog/db.changelog-master.xml` — include 007

**Frontend — new files**
- `frontend/src/api/views.ts`
- `frontend/src/pages/ViewsPage.tsx`
- `frontend/src/pages/ViewDetailPage.tsx`

**Frontend — modified files**
- `frontend/src/App.tsx` — add `/views` and `/views/:id` routes
- `frontend/src/components/Layout.tsx` — add Views nav link
- `frontend/src/pages/TransactionPage.tsx` — add "Add to view" button + modal

---

## Task 1: DB Migration — Views Schema

**Files:**
- Create: `backend/src/main/resources/db/changelog/changes/007-views-schema.sql`
- Modify: `backend/src/main/resources/db/changelog/db.changelog-master.xml`

- [ ] **Step 1: Create the migration file**

```sql
--liquibase formatted sql

--changeset omprakash:007-views-schema

CREATE TABLE spend_view (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID         NOT NULL REFERENCES household(id),
    name         VARCHAR(200) NOT NULL,
    type         VARCHAR(20)  NOT NULL CHECK (type IN ('TRIP', 'EVENT', 'CUSTOM')),
    start_date   DATE         NOT NULL,
    end_date     DATE         NOT NULL,
    description  TEXT,
    color        VARCHAR(20),
    total_budget NUMERIC(15, 2),
    created_at   TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE TABLE view_transaction (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    view_id        UUID NOT NULL REFERENCES spend_view(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES financial_transaction(id) ON DELETE CASCADE,
    UNIQUE (view_id, transaction_id)
);

CREATE TABLE view_category_budget (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    view_id         UUID           NOT NULL REFERENCES spend_view(id) ON DELETE CASCADE,
    category_id     UUID           NOT NULL REFERENCES category(id),
    expected_amount NUMERIC(15, 2) NOT NULL,
    UNIQUE (view_id, category_id)
);

CREATE INDEX idx_spend_view_household   ON spend_view(household_id);
CREATE INDEX idx_view_transaction_view  ON view_transaction(view_id);
CREATE INDEX idx_view_transaction_tx    ON view_transaction(transaction_id);
```

Save to: `backend/src/main/resources/db/changelog/changes/007-views-schema.sql`

- [ ] **Step 2: Register the migration in the master changelog**

Open `backend/src/main/resources/db/changelog/db.changelog-master.xml` and add before the closing `</databaseChangeLog>` tag:

```xml
    <include file="db/changelog/changes/007-views-schema.sql"/>
```

The file should end as:
```xml
    <include file="db/changelog/changes/006-custom-categories.sql"/>
    <include file="db/changelog/changes/007-views-schema.sql"/>

</databaseChangeLog>
```

- [ ] **Step 3: Verify backend still compiles**

```bash
mvn -f backend/pom.xml package -DskipTests -q
```

Expected: `BUILD SUCCESS`

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/db/changelog/changes/007-views-schema.sql \
        backend/src/main/resources/db/changelog/db.changelog-master.xml
git commit -m "feat(db): migration 007 — spend_view, view_transaction, view_category_budget tables"
```

---

## Task 2: Backend Entities

**Files:**
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/model/ViewType.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/model/SpendView.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/model/ViewTransactionLink.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/model/ViewCategoryBudget.java`

- [ ] **Step 1: Create `ViewType` enum**

```java
package com.omprakashgautam.homelab.spends.model;

public enum ViewType {
    TRIP, EVENT, CUSTOM
}
```

Save to: `backend/src/main/java/com/omprakashgautam/homelab/spends/model/ViewType.java`

- [ ] **Step 2: Create `SpendView` entity**

(`SpendView` avoids conflict with SQL reserved word `VIEW`)

```java
package com.omprakashgautam.homelab.spends.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "spend_view")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpendView {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "household_id", nullable = false)
    private Household household;

    @Column(nullable = false, length = 200)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ViewType type;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 20)
    private String color;

    @Column(name = "total_budget", precision = 15, scale = 2)
    private BigDecimal totalBudget;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
```

Save to: `backend/src/main/java/com/omprakashgautam/homelab/spends/model/SpendView.java`

- [ ] **Step 3: Create `ViewTransactionLink` entity**

```java
package com.omprakashgautam.homelab.spends.model;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(
    name = "view_transaction",
    uniqueConstraints = @UniqueConstraint(columnNames = {"view_id", "transaction_id"})
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ViewTransactionLink {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "view_id", nullable = false)
    private SpendView view;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transaction_id", nullable = false)
    private Transaction transaction;
}
```

Save to: `backend/src/main/java/com/omprakashgautam/homelab/spends/model/ViewTransactionLink.java`

- [ ] **Step 4: Create `ViewCategoryBudget` entity**

```java
package com.omprakashgautam.homelab.spends.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(
    name = "view_category_budget",
    uniqueConstraints = @UniqueConstraint(columnNames = {"view_id", "category_id"})
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ViewCategoryBudget {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "view_id", nullable = false)
    private SpendView view;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Column(name = "expected_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal expectedAmount;
}
```

Save to: `backend/src/main/java/com/omprakashgautam/homelab/spends/model/ViewCategoryBudget.java`

- [ ] **Step 5: Verify compilation**

```bash
mvn -f backend/pom.xml package -DskipTests -q
```

Expected: `BUILD SUCCESS`

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/model/ViewType.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/model/SpendView.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/model/ViewTransactionLink.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/model/ViewCategoryBudget.java
git commit -m "feat: add SpendView, ViewTransactionLink, ViewCategoryBudget entities"
```

---

## Task 3: DTOs

**Files:**
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/ViewDto.java`

- [ ] **Step 1: Create `ViewDto` with all records**

```java
package com.omprakashgautam.homelab.spends.dto;

import com.omprakashgautam.homelab.spends.model.ViewType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class ViewDto {

    /** Inbound: one category budget line in a create request */
    public record CategoryBudgetRequest(
            UUID categoryId,
            BigDecimal expectedAmount
    ) {}

    /** Inbound: create a new view */
    public record CreateRequest(
            String name,
            ViewType type,
            LocalDate startDate,
            LocalDate endDate,
            String description,
            String color,
            BigDecimal totalBudget,
            List<CategoryBudgetRequest> categoryBudgets
    ) {}

    /** Inbound: update view metadata (dates and type are immutable) */
    public record UpdateRequest(
            String name,
            String description,
            String color,
            BigDecimal totalBudget
    ) {}

    /** Outbound: one category row (used in both list response and summary) */
    public record CategoryBudgetItem(
            UUID categoryId,
            String categoryName,
            String categoryColor,
            BigDecimal expectedAmount,   // null if no budget set for this category
            BigDecimal actualAmount      // 0 in list view, computed in summary
    ) {}

    /** Outbound: card in the views list + single-view GET */
    public record ViewResponse(
            UUID id,
            String name,
            ViewType type,
            LocalDate startDate,
            LocalDate endDate,
            String description,
            String color,
            BigDecimal totalBudget,
            BigDecimal totalSpent,
            int transactionCount,
            List<CategoryBudgetItem> categoryBudgets
    ) {}

    /** Outbound: per-member spend in summary */
    public record MemberBreakdown(
            UUID userId,
            String displayName,
            BigDecimal amount,
            long count
    ) {}

    /** Outbound: full summary (Summary tab) */
    public record SummaryResponse(
            UUID viewId,
            String name,
            BigDecimal totalBudget,
            BigDecimal totalSpent,
            long transactionCount,
            List<CategoryBudgetItem> categories,
            List<MemberBreakdown> members
    ) {}

    /** Outbound: one transaction row (List + Board tabs) */
    public record TransactionItem(
            UUID id,
            String merchantName,
            String rawRemarks,
            LocalDate valueDate,
            BigDecimal withdrawalAmount,
            BigDecimal depositAmount,
            String categoryName,
            String categoryColor,
            String memberName
    ) {}

    /** Outbound: paginated transaction list */
    public record TransactionPage(
            List<TransactionItem> content,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {}

    /** Inbound: add one or more transactions to a view */
    public record AddTransactionsRequest(
            List<UUID> transactionIds
    ) {}
}
```

- [ ] **Step 2: Verify compilation**

```bash
mvn -f backend/pom.xml package -DskipTests -q
```

Expected: `BUILD SUCCESS`

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/dto/ViewDto.java
git commit -m "feat: add ViewDto records"
```

---

## Task 4: Repositories

**Files:**
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/ViewRepository.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/ViewTransactionLinkRepository.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/ViewCategoryBudgetRepository.java`

- [ ] **Step 1: Create `ViewRepository`**

```java
package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.SpendView;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ViewRepository extends JpaRepository<SpendView, UUID> {
    List<SpendView> findByHouseholdIdOrderByStartDateDesc(UUID householdId);
}
```

- [ ] **Step 2: Create `ViewTransactionLinkRepository`**

```java
package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.Transaction;
import com.omprakashgautam.homelab.spends.model.ViewTransactionLink;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ViewTransactionLinkRepository extends JpaRepository<ViewTransactionLink, UUID> {

    boolean existsByViewIdAndTransactionId(UUID viewId, UUID transactionId);

    Optional<ViewTransactionLink> findByViewIdAndTransactionId(UUID viewId, UUID transactionId);

    long countByViewId(UUID viewId);

    // ── List tab: paginated transactions in a view ─────────────────────────────

    @Query("""
        SELECT vtl.transaction
        FROM ViewTransactionLink vtl
        WHERE vtl.view.id = :viewId
        ORDER BY vtl.transaction.valueDate DESC
        """)
    Page<Transaction> findTransactionsByViewId(@Param("viewId") UUID viewId, Pageable pageable);

    // ── Auto-tag on create ────────────────────────────────────────────────────

    @Query("""
        SELECT t FROM Transaction t
        WHERE t.bankAccount.user.household.id = :householdId
          AND t.valueDate >= :startDate
          AND t.valueDate <= :endDate
        """)
    List<Transaction> findHouseholdTransactionsInRange(
            @Param("householdId") UUID householdId,
            @Param("startDate")   LocalDate startDate,
            @Param("endDate")     LocalDate endDate
    );

    // ── Summary: total debit spend ─────────────────────────────────────────────

    @Query("""
        SELECT COALESCE(SUM(vtl.transaction.withdrawalAmount), 0)
        FROM ViewTransactionLink vtl
        WHERE vtl.view.id = :viewId
          AND vtl.transaction.withdrawalAmount > 0
        """)
    BigDecimal totalSpentByViewId(@Param("viewId") UUID viewId);

    // ── Summary: category breakdown ────────────────────────────────────────────

    @Query("""
        SELECT vtl.transaction.category.id,
               vtl.transaction.category.name,
               vtl.transaction.category.color,
               COALESCE(SUM(vtl.transaction.withdrawalAmount), 0)
        FROM ViewTransactionLink vtl
        WHERE vtl.view.id = :viewId
          AND vtl.transaction.withdrawalAmount > 0
          AND vtl.transaction.category IS NOT NULL
        GROUP BY vtl.transaction.category.id,
                 vtl.transaction.category.name,
                 vtl.transaction.category.color
        ORDER BY SUM(vtl.transaction.withdrawalAmount) DESC
        """)
    List<Object[]> categoryBreakdownByViewId(@Param("viewId") UUID viewId);

    // ── Summary: per-member breakdown ──────────────────────────────────────────

    @Query("""
        SELECT vtl.transaction.bankAccount.user.id,
               vtl.transaction.bankAccount.user.displayName,
               COALESCE(SUM(vtl.transaction.withdrawalAmount), 0),
               COUNT(vtl)
        FROM ViewTransactionLink vtl
        WHERE vtl.view.id = :viewId
          AND vtl.transaction.withdrawalAmount > 0
        GROUP BY vtl.transaction.bankAccount.user.id,
                 vtl.transaction.bankAccount.user.displayName
        ORDER BY SUM(vtl.transaction.withdrawalAmount) DESC
        """)
    List<Object[]> memberBreakdownByViewId(@Param("viewId") UUID viewId);
}
```

- [ ] **Step 3: Create `ViewCategoryBudgetRepository`**

```java
package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.ViewCategoryBudget;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ViewCategoryBudgetRepository extends JpaRepository<ViewCategoryBudget, UUID> {
    List<ViewCategoryBudget> findByViewId(UUID viewId);
    void deleteByViewId(UUID viewId);
}
```

- [ ] **Step 4: Verify compilation**

```bash
mvn -f backend/pom.xml package -DskipTests -q
```

Expected: `BUILD SUCCESS`

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/repository/ViewRepository.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/repository/ViewTransactionLinkRepository.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/repository/ViewCategoryBudgetRepository.java
git commit -m "feat: add view repositories"
```

---

## Task 5: ViewService

**Files:**
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/ViewService.java`

- [ ] **Step 1: Create `ViewService`**

```java
package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.ViewDto;
import com.omprakashgautam.homelab.spends.model.*;
import com.omprakashgautam.homelab.spends.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ViewService {

    private final ViewRepository viewRepository;
    private final ViewTransactionLinkRepository linkRepository;
    private final ViewCategoryBudgetRepository categoryBudgetRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final CategoryRepository categoryRepository;

    // ── List ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ViewDto.ViewResponse> listViews(UUID userId) {
        Household household = requireHousehold(userId);
        return viewRepository
                .findByHouseholdIdOrderByStartDateDesc(household.getId())
                .stream()
                .map(this::toViewResponse)
                .toList();
    }

    // ── Create ────────────────────────────────────────────────────────────────

    @Transactional
    public ViewDto.ViewResponse createView(UUID userId, ViewDto.CreateRequest req) {
        Household household = requireHousehold(userId);

        SpendView view = viewRepository.save(SpendView.builder()
                .household(household)
                .name(req.name())
                .type(req.type())
                .startDate(req.startDate())
                .endDate(req.endDate())
                .description(req.description())
                .color(req.color())
                .totalBudget(req.totalBudget())
                .build());

        // Persist category budgets from template / user input
        if (req.categoryBudgets() != null && !req.categoryBudgets().isEmpty()) {
            List<ViewCategoryBudget> budgets = req.categoryBudgets().stream()
                    .map(cb -> ViewCategoryBudget.builder()
                            .view(view)
                            .category(categoryRepository.getReferenceById(cb.categoryId()))
                            .expectedAmount(cb.expectedAmount())
                            .build())
                    .toList();
            categoryBudgetRepository.saveAll(budgets);
        }

        // Auto-tag all household transactions in the date range
        List<Transaction> txs = linkRepository
                .findHouseholdTransactionsInRange(household.getId(), req.startDate(), req.endDate());
        List<ViewTransactionLink> links = txs.stream()
                .map(tx -> ViewTransactionLink.builder().view(view).transaction(tx).build())
                .toList();
        linkRepository.saveAll(links);

        return toViewResponse(view);
    }

    // ── Get single view ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ViewDto.ViewResponse getView(UUID userId, UUID viewId) {
        return toViewResponse(resolveView(userId, viewId));
    }

    // ── Update (metadata only — dates/type are immutable) ────────────────────

    @Transactional
    public ViewDto.ViewResponse updateView(UUID userId, UUID viewId, ViewDto.UpdateRequest req) {
        SpendView view = resolveView(userId, viewId);
        view.setName(req.name());
        view.setDescription(req.description());
        view.setColor(req.color());
        view.setTotalBudget(req.totalBudget());
        return toViewResponse(viewRepository.save(view));
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    @Transactional
    public void deleteView(UUID userId, UUID viewId) {
        viewRepository.delete(resolveView(userId, viewId));
    }

    // ── Paginated transactions (List tab) ─────────────────────────────────────

    @Transactional(readOnly = true)
    public ViewDto.TransactionPage getTransactions(UUID userId, UUID viewId, int page, int size) {
        resolveView(userId, viewId);
        Page<Transaction> txPage = linkRepository
                .findTransactionsByViewId(viewId, PageRequest.of(page, size));
        return new ViewDto.TransactionPage(
                txPage.getContent().stream().map(this::toTransactionItem).toList(),
                page, size,
                txPage.getTotalElements(),
                txPage.getTotalPages()
        );
    }

    // ── Summary (Summary tab) ─────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ViewDto.SummaryResponse getSummary(UUID userId, UUID viewId) {
        SpendView view = resolveView(userId, viewId);

        BigDecimal totalSpent = linkRepository.totalSpentByViewId(viewId);
        long count = linkRepository.countByViewId(viewId);

        // Expected amounts keyed by category UUID
        Map<UUID, BigDecimal> expectedMap = categoryBudgetRepository.findByViewId(viewId)
                .stream()
                .collect(Collectors.toMap(
                        vcb -> vcb.getCategory().getId(),
                        ViewCategoryBudget::getExpectedAmount));

        List<ViewDto.CategoryBudgetItem> categories = linkRepository
                .categoryBreakdownByViewId(viewId)
                .stream()
                .map(row -> new ViewDto.CategoryBudgetItem(
                        (UUID) row[0],
                        (String) row[1],
                        (String) row[2],
                        expectedMap.get((UUID) row[0]),
                        (BigDecimal) row[3]))
                .toList();

        List<ViewDto.MemberBreakdown> members = linkRepository
                .memberBreakdownByViewId(viewId)
                .stream()
                .map(row -> new ViewDto.MemberBreakdown(
                        (UUID) row[0],
                        (String) row[1],
                        (BigDecimal) row[2],
                        (Long) row[3]))
                .toList();

        return new ViewDto.SummaryResponse(
                viewId, view.getName(), view.getTotalBudget(),
                totalSpent, count, categories, members);
    }

    // ── Manually add transactions ─────────────────────────────────────────────

    @Transactional
    public void addTransactions(UUID userId, UUID viewId, List<UUID> txIds) {
        SpendView view = resolveView(userId, viewId);
        txIds.forEach(txId -> {
            if (!linkRepository.existsByViewIdAndTransactionId(viewId, txId)) {
                linkRepository.save(ViewTransactionLink.builder()
                        .view(view)
                        .transaction(transactionRepository.getReferenceById(txId))
                        .build());
            }
        });
    }

    // ── Manually remove a transaction ─────────────────────────────────────────

    @Transactional
    public void removeTransaction(UUID userId, UUID viewId, UUID txId) {
        resolveView(userId, viewId);
        linkRepository.findByViewIdAndTransactionId(viewId, txId)
                .ifPresent(linkRepository::delete);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private SpendView resolveView(UUID userId, UUID viewId) {
        Household household = requireHousehold(userId);
        SpendView view = viewRepository.findById(viewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "View not found"));
        if (!view.getHousehold().getId().equals(household.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return view;
    }

    private Household requireHousehold(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"))
                .getHousehold();
    }

    private ViewDto.ViewResponse toViewResponse(SpendView view) {
        BigDecimal totalSpent = linkRepository.totalSpentByViewId(view.getId());
        long count = linkRepository.countByViewId(view.getId());
        List<ViewDto.CategoryBudgetItem> budgetItems = categoryBudgetRepository
                .findByViewId(view.getId())
                .stream()
                .map(vcb -> new ViewDto.CategoryBudgetItem(
                        vcb.getCategory().getId(),
                        vcb.getCategory().getName(),
                        vcb.getCategory().getColor(),
                        vcb.getExpectedAmount(),
                        BigDecimal.ZERO))
                .toList();
        return new ViewDto.ViewResponse(
                view.getId(), view.getName(), view.getType(),
                view.getStartDate(), view.getEndDate(),
                view.getDescription(), view.getColor(),
                view.getTotalBudget(),
                totalSpent != null ? totalSpent : BigDecimal.ZERO,
                (int) count,
                budgetItems);
    }

    private ViewDto.TransactionItem toTransactionItem(Transaction tx) {
        return new ViewDto.TransactionItem(
                tx.getId(),
                tx.getMerchantName(),
                tx.getRawRemarks(),
                tx.getValueDate(),
                tx.getWithdrawalAmount(),
                tx.getDepositAmount(),
                tx.getCategory() != null ? tx.getCategory().getName() : null,
                tx.getCategory() != null ? tx.getCategory().getColor() : null,
                tx.getBankAccount().getUser().getDisplayName());
    }
}
```

- [ ] **Step 2: Verify compilation**

```bash
mvn -f backend/pom.xml package -DskipTests -q
```

Expected: `BUILD SUCCESS`

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/service/ViewService.java
git commit -m "feat: add ViewService — CRUD, auto-tag, summary, add/remove transactions"
```

---

## Task 6: ViewController

**Files:**
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/ViewController.java`

- [ ] **Step 1: Create the controller**

```java
package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.ViewDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.ViewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/views")
@RequiredArgsConstructor
public class ViewController {

    private final ViewService viewService;

    @GetMapping
    public ResponseEntity<List<ViewDto.ViewResponse>> listViews(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        return ResponseEntity.ok(viewService.listViews(principal.getId()));
    }

    @PostMapping
    public ResponseEntity<ViewDto.ViewResponse> createView(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestBody ViewDto.CreateRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(viewService.createView(principal.getId(), req));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ViewDto.ViewResponse> getView(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id) {
        return ResponseEntity.ok(viewService.getView(principal.getId(), id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ViewDto.ViewResponse> updateView(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id,
            @RequestBody ViewDto.UpdateRequest req) {
        return ResponseEntity.ok(viewService.updateView(principal.getId(), id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteView(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id) {
        viewService.deleteView(principal.getId(), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/transactions")
    public ResponseEntity<ViewDto.TransactionPage> getTransactions(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return ResponseEntity.ok(viewService.getTransactions(principal.getId(), id, page, size));
    }

    @GetMapping("/{id}/summary")
    public ResponseEntity<ViewDto.SummaryResponse> getSummary(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id) {
        return ResponseEntity.ok(viewService.getSummary(principal.getId(), id));
    }

    @PostMapping("/{id}/transactions")
    public ResponseEntity<Void> addTransactions(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id,
            @RequestBody ViewDto.AddTransactionsRequest req) {
        viewService.addTransactions(principal.getId(), id, req.transactionIds());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/transactions/{txId}")
    public ResponseEntity<Void> removeTransaction(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id,
            @PathVariable UUID txId) {
        viewService.removeTransaction(principal.getId(), id, txId);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 2: Verify full backend build**

```bash
mvn -f backend/pom.xml package -DskipTests -q
```

Expected: `BUILD SUCCESS`

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/controller/ViewController.java
git commit -m "feat: add ViewController — 9 REST endpoints for views feature"
```

---

## Task 7: Frontend API Client

**Files:**
- Create: `frontend/src/api/views.ts`

- [ ] **Step 1: Create `views.ts`**

```typescript
import apiClient from './client'

export type ViewType = 'TRIP' | 'EVENT' | 'CUSTOM'

export interface CategoryBudgetItem {
  categoryId: string
  categoryName: string
  categoryColor: string | null
  expectedAmount: number | null
  actualAmount: number
}

export interface ViewResponse {
  id: string
  name: string
  type: ViewType
  startDate: string          // 'YYYY-MM-DD'
  endDate: string            // 'YYYY-MM-DD'
  description: string | null
  color: string | null
  totalBudget: number | null
  totalSpent: number
  transactionCount: number
  categoryBudgets: CategoryBudgetItem[]
}

export interface CreateViewRequest {
  name: string
  type: ViewType
  startDate: string
  endDate: string
  description?: string
  color?: string
  totalBudget?: number
  categoryBudgets: { categoryId: string; expectedAmount: number }[]
}

export interface UpdateViewRequest {
  name: string
  description?: string
  color?: string
  totalBudget?: number
}

export interface ViewTransactionItem {
  id: string
  merchantName: string | null
  rawRemarks: string
  valueDate: string
  withdrawalAmount: number
  depositAmount: number
  categoryName: string | null
  categoryColor: string | null
  memberName: string
}

export interface ViewTransactionPage {
  content: ViewTransactionItem[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface MemberBreakdown {
  userId: string
  displayName: string
  amount: number
  count: number
}

export interface ViewSummary {
  viewId: string
  name: string
  totalBudget: number | null
  totalSpent: number
  transactionCount: number
  categories: CategoryBudgetItem[]
  members: MemberBreakdown[]
}

// ── Template helpers (UI-only, no API call) ───────────────────────────────────

export type TemplateLine = { categoryName: string; suggested: number }

export const TRIP_TEMPLATE: TemplateLine[] = [
  { categoryName: 'Transport',     suggested: 15000 },
  { categoryName: 'Food & Dining', suggested: 10000 },
  { categoryName: 'Entertainment', suggested: 5000  },
  { categoryName: 'Shopping',      suggested: 5000  },
]

export const EVENT_TEMPLATE: TemplateLine[] = [
  { categoryName: 'Shopping',      suggested: 20000 },
  { categoryName: 'Food & Dining', suggested: 15000 },
  { categoryName: 'Entertainment', suggested: 10000 },
  { categoryName: 'Miscellaneous', suggested: 5000  },
]

// ── API functions ─────────────────────────────────────────────────────────────

export async function listViews(): Promise<ViewResponse[]> {
  const { data } = await apiClient.get<ViewResponse[]>('/views')
  return data
}

export async function createView(req: CreateViewRequest): Promise<ViewResponse> {
  const { data } = await apiClient.post<ViewResponse>('/views', req)
  return data
}

export async function getView(id: string): Promise<ViewResponse> {
  const { data } = await apiClient.get<ViewResponse>(`/views/${id}`)
  return data
}

export async function updateView(id: string, req: UpdateViewRequest): Promise<ViewResponse> {
  const { data } = await apiClient.put<ViewResponse>(`/views/${id}`, req)
  return data
}

export async function deleteView(id: string): Promise<void> {
  await apiClient.delete(`/views/${id}`)
}

export async function getViewTransactions(id: string, page = 0, size = 25): Promise<ViewTransactionPage> {
  const { data } = await apiClient.get<ViewTransactionPage>(`/views/${id}/transactions`, {
    params: { page, size },
  })
  return data
}

export async function getViewSummary(id: string): Promise<ViewSummary> {
  const { data } = await apiClient.get<ViewSummary>(`/views/${id}/summary`)
  return data
}

export async function addTransactionsToView(viewId: string, transactionIds: string[]): Promise<void> {
  await apiClient.post(`/views/${viewId}/transactions`, { transactionIds })
}

export async function removeTransactionFromView(viewId: string, txId: string): Promise<void> {
  await apiClient.delete(`/views/${viewId}/transactions/${txId}`)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build --prefix frontend 2>&1 | tail -5
```

Expected: no errors, `built in Xs`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/views.ts
git commit -m "feat: add views API client"
```

---

## Task 8: ViewsPage — Card Grid

**Files:**
- Create: `frontend/src/pages/ViewsPage.tsx`

This page shows all views as cards and hosts the create modal.

- [ ] **Step 1: Create `ViewsPage.tsx`**

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Plus, MapPin, Calendar, Wallet, Trash2, Loader2, LayoutGrid,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  listViews, createView, deleteView,
  type ViewResponse, type ViewType, type CreateViewRequest,
  TRIP_TEMPLATE, EVENT_TEMPLATE,
} from '../api/views'
import { getCategories, type Category } from '../api/categories'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L'
  if (n >= 1000)   return '₹' + (n / 1000).toFixed(1) + 'K'
  return '₹' + n.toLocaleString('en-IN')
}

function fmtDate(s: string) {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

const TYPE_LABEL: Record<ViewType, string>  = { TRIP: 'Trip', EVENT: 'Event', CUSTOM: 'Custom' }
const TYPE_COLOR: Record<ViewType, string>  = {
  TRIP:   'bg-blue-100 text-blue-700',
  EVENT:  'bg-purple-100 text-purple-700',
  CUSTOM: 'bg-gray-100 text-gray-600',
}

// ── View card ─────────────────────────────────────────────────────────────────

function ViewCard({ view, onDelete }: { view: ViewResponse; onDelete: () => void }) {
  const navigate = useNavigate()
  const pct = view.totalBudget && view.totalBudget > 0
    ? Math.min(100, Math.round((view.totalSpent / view.totalBudget) * 100))
    : null

  return (
    <div
      onClick={() => navigate(`/views/${view.id}`)}
      className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {view.color && (
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: view.color }}
            />
          )}
          <h3 className="font-semibold text-gray-900 truncate">{view.name}</h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', TYPE_COLOR[view.type])}>
            {TYPE_LABEL[view.type]}
          </span>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="p-1 text-gray-400 hover:text-red-500 rounded"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Date range */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
        <Calendar className="w-3.5 h-3.5" />
        {fmtDate(view.startDate)} — {fmtDate(view.endDate)}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm mb-3">
        <span className="text-gray-500">{view.transactionCount} transactions</span>
        <span className="font-semibold text-gray-900">{fmt(view.totalSpent)}</span>
      </div>

      {/* Budget progress */}
      {view.totalBudget && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Budget</span>
            <span>{pct}% of {fmt(view.totalBudget)}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={clsx('h-full rounded-full', pct! >= 100 ? 'bg-red-500' : pct! >= 80 ? 'bg-amber-400' : 'bg-blue-500')}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Create modal ──────────────────────────────────────────────────────────────

const STEPS = ['Details', 'Type', 'Budget', 'Done'] as const
type Step = typeof STEPS[number]

function CreateViewModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [step, setStep]           = useState<Step>('Details')
  const [name, setName]           = useState('')
  const [type, setType]           = useState<ViewType>('TRIP')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [description, setDesc]    = useState('')
  const [color, setColor]         = useState('#3B82F6')
  const [totalBudget, setBudget]  = useState('')
  const [catBudgets, setCatBudgets] = useState<{ categoryId: string; expectedAmount: number }[]>([])

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: getCategories,
  })

  const createMut = useMutation({
    mutationFn: createView,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['views'] })
      onClose()
    },
  })

  // Apply template: match category names, pre-fill amounts
  function applyTemplate(t: ViewType) {
    setType(t)
    const template = t === 'TRIP' ? TRIP_TEMPLATE : t === 'EVENT' ? EVENT_TEMPLATE : []
    const lines = template
      .map(line => {
        const cat = categories.find(c => c.name === line.categoryName)
        return cat ? { categoryId: cat.id, expectedAmount: line.suggested } : null
      })
      .filter(Boolean) as { categoryId: string; expectedAmount: number }[]
    setCatBudgets(lines)
  }

  function handleSubmit() {
    const req: CreateViewRequest = {
      name,
      type,
      startDate,
      endDate,
      description: description || undefined,
      color,
      totalBudget: totalBudget ? Number(totalBudget) : undefined,
      categoryBudgets: catBudgets,
    }
    createMut.mutate(req)
  }

  const canNext =
    step === 'Details' ? name.trim() && startDate && endDate && endDate >= startDate :
    step === 'Type'    ? true :
    step === 'Budget'  ? true : false

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Create View</h2>
          <div className="flex gap-1">
            {STEPS.map((s, i) => (
              <div key={s} className={clsx('w-2 h-2 rounded-full', s === step ? 'bg-blue-600' : i < STEPS.indexOf(step) ? 'bg-blue-200' : 'bg-gray-200')} />
            ))}
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Step 1: Details */}
          {step === 'Details' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Goa Trip, Shaadi 2025"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                  <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
                  <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Short note"
                  value={description}
                  onChange={e => setDesc(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Color</label>
                <input type="color" className="w-8 h-8 rounded cursor-pointer border-0" value={color} onChange={e => setColor(e.target.value)} />
                <span className="text-xs text-gray-400 font-mono">{color}</span>
              </div>
            </>
          )}

          {/* Step 2: Type + template */}
          {step === 'Type' && (
            <>
              <p className="text-sm text-gray-500">Pick a type. Trip and Event pre-fill suggested category budgets.</p>
              <div className="space-y-2">
                {(['TRIP', 'EVENT', 'CUSTOM'] as ViewType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => applyTemplate(t)}
                    className={clsx(
                      'w-full text-left px-4 py-3 rounded-xl border-2 transition-colors',
                      type === t ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <p className="font-medium text-sm">{TYPE_LABEL[t]}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t === 'TRIP' ? 'Transport, Food, Entertainment, Shopping' :
                       t === 'EVENT' ? 'Shopping, Food, Entertainment, Miscellaneous' :
                       'No preset — set budgets manually'}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 3: Budget */}
          {step === 'Budget' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total budget (optional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400 text-sm">₹</span>
                  <input
                    type="number" min="0"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 50000"
                    value={totalBudget}
                    onChange={e => setBudget(e.target.value)}
                  />
                </div>
              </div>
              {catBudgets.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Category budgets (from template)</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {catBudgets.map((cb, i) => {
                      const cat = categories.find(c => c.id === cb.categoryId)
                      return (
                        <div key={cb.categoryId} className="flex items-center gap-2">
                          {cat?.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color ?? undefined }} />}
                          <span className="text-sm text-gray-600 flex-1">{cat?.name}</span>
                          <div className="relative w-28">
                            <span className="absolute left-2 top-1.5 text-gray-400 text-xs">₹</span>
                            <input
                              type="number" min="0"
                              className="w-full pl-5 pr-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                              value={cb.expectedAmount}
                              onChange={e => {
                                const updated = [...catBudgets]
                                updated[i] = { ...cb, expectedAmount: Number(e.target.value) }
                                setCatBudgets(updated)
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between px-6 py-4 border-t border-gray-100">
          <button
            onClick={step === 'Details' ? onClose : () => setStep(STEPS[STEPS.indexOf(step) - 1])}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            {step === 'Details' ? 'Cancel' : 'Back'}
          </button>
          {step !== 'Budget' ? (
            <button
              disabled={!canNext}
              onClick={() => setStep(STEPS[STEPS.indexOf(step) + 1])}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={createMut.isPending}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center gap-2"
            >
              {createMut.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create View
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ViewsPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const { data: views = [], isLoading } = useQuery<ViewResponse[]>({
    queryKey: ['views'],
    queryFn: listViews,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteView(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['views'] }),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Views</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track spend for trips and events</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New View
        </button>
      </div>

      {/* Card grid */}
      {views.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <LayoutGrid className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No views yet</p>
          <p className="text-sm mt-1">Create a view to track spending for a trip or event</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {views.map(v => (
            <ViewCard
              key={v.id}
              view={v}
              onDelete={() => {
                if (confirm(`Delete "${v.name}"? This cannot be undone.`)) {
                  deleteMut.mutate(v.id)
                }
              }}
            />
          ))}
        </div>
      )}

      {showCreate && <CreateViewModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build --prefix frontend 2>&1 | tail -5
```

Expected: no type errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ViewsPage.tsx
git commit -m "feat: add ViewsPage with card grid and multi-step create modal"
```

---

## Task 9: ViewDetailPage — List, Board, Summary Tabs

**Files:**
- Create: `frontend/src/pages/ViewDetailPage.tsx`

- [ ] **Step 1: Create `ViewDetailPage.tsx`**

```tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, List, LayoutGrid, BarChart2, Loader2, X, Plus } from 'lucide-react'
import { clsx } from 'clsx'
import {
  getView, getViewTransactions, getViewSummary,
  removeTransactionFromView, addTransactionsToView,
  type ViewResponse, type ViewTransactionItem, type ViewSummary,
  type CategoryBudgetItem,
} from '../api/views'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L'
  if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'K'
  return '₹' + n.toLocaleString('en-IN')
}

function fmtFull(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s: string) {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

// ── List tab ──────────────────────────────────────────────────────────────────

function ListTab({ viewId }: { viewId: string }) {
  const qc = useQueryClient()
  const [page, setPage] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['view-transactions', viewId, page],
    queryFn: () => getViewTransactions(viewId, page, 25),
  })

  const removeMut = useMutation({
    mutationFn: (txId: string) => removeTransactionFromView(viewId, txId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['view-transactions', viewId] }),
  })

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
  if (!data || data.content.length === 0) return <p className="text-center text-gray-400 py-12">No transactions in this view.</p>

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 font-medium">
              <th className="pb-2 pr-4 pl-1">Date</th>
              <th className="pb-2 pr-4">Merchant</th>
              <th className="pb-2 pr-4">Category</th>
              <th className="pb-2 pr-4">Member</th>
              <th className="pb-2 pr-4 text-right">Amount</th>
              <th className="pb-2 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.content.map((tx: ViewTransactionItem) => (
              <tr key={tx.id} className="hover:bg-gray-50">
                <td className="py-2 pr-4 pl-1 text-gray-500 whitespace-nowrap">{fmtDate(tx.valueDate)}</td>
                <td className="py-2 pr-4 max-w-[180px]">
                  <p className="truncate font-medium text-gray-800">{tx.merchantName ?? '—'}</p>
                  <p className="truncate text-xs text-gray-400">{tx.rawRemarks}</p>
                </td>
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-1.5">
                    {tx.categoryColor && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tx.categoryColor }} />}
                    <span className="text-gray-600">{tx.categoryName ?? '—'}</span>
                  </div>
                </td>
                <td className="py-2 pr-4 text-gray-500">{tx.memberName}</td>
                <td className="py-2 pr-4 text-right font-mono">
                  {tx.withdrawalAmount > 0
                    ? <span className="text-red-600">{fmtFull(tx.withdrawalAmount)}</span>
                    : <span className="text-green-600">{fmtFull(tx.depositAmount)}</span>}
                </td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => removeMut.mutate(tx.id)}
                    disabled={removeMut.isPending}
                    className="p-1 text-gray-300 hover:text-red-500 rounded"
                    title="Remove from view"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>{data.totalElements} transactions</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
              Prev
            </button>
            <span className="px-3 py-1.5">{page + 1} / {data.totalPages}</span>
            <button disabled={page >= data.totalPages - 1} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Board tab ─────────────────────────────────────────────────────────────────

function BoardTab({ viewId }: { viewId: string }) {
  // Fetch all transactions (large page) then group by category on client
  const { data, isLoading } = useQuery({
    queryKey: ['view-transactions', viewId, 'all'],
    queryFn: () => getViewTransactions(viewId, 0, 500),
  })

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
  if (!data || data.content.length === 0) return <p className="text-center text-gray-400 py-12">No transactions in this view.</p>

  // Group by category
  const groups = data.content.reduce<Record<string, ViewTransactionItem[]>>((acc, tx) => {
    const key = tx.categoryName ?? 'Uncategorised'
    if (!acc[key]) acc[key] = []
    acc[key].push(tx)
    return acc
  }, {})

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 pb-4" style={{ minWidth: `${Object.keys(groups).length * 220}px` }}>
        {Object.entries(groups).map(([cat, txs]) => {
          const total = txs.reduce((s, tx) => s + tx.withdrawalAmount, 0)
          const color = txs[0]?.categoryColor
          return (
            <div key={cat} className="w-52 flex-shrink-0">
              <div className="flex items-center gap-1.5 mb-2">
                {color && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />}
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide truncate">{cat}</span>
              </div>
              <p className="text-xs text-gray-400 mb-2">{fmt(total)}</p>
              <div className="space-y-2">
                {txs.map(tx => (
                  <div key={tx.id} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                    <p className="text-sm font-medium text-gray-800 truncate">{tx.merchantName ?? tx.rawRemarks.slice(0, 30)}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-400">{fmtDate(tx.valueDate)}</span>
                      <span className="text-xs font-mono font-semibold text-red-600">{fmt(tx.withdrawalAmount)}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{tx.memberName}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Summary tab ───────────────────────────────────────────────────────────────

function SummaryTab({ viewId }: { viewId: string }) {
  const { data: summary, isLoading } = useQuery<ViewSummary>({
    queryKey: ['view-summary', viewId],
    queryFn: () => getViewSummary(viewId),
  })

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
  if (!summary) return null

  const budgetPct = summary.totalBudget && summary.totalBudget > 0
    ? Math.min(100, Math.round((summary.totalSpent / summary.totalBudget) * 100))
    : null

  return (
    <div className="space-y-6">
      {/* Total gauge */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm text-gray-500 mb-1">Total Spent</p>
        <p className="text-3xl font-bold text-gray-900 mb-3">{fmtFull(summary.totalSpent)}</p>
        {summary.totalBudget && (
          <>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Budget: {fmtFull(summary.totalBudget)}</span>
              <span>{budgetPct}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full', budgetPct! >= 100 ? 'bg-red-500' : budgetPct! >= 80 ? 'bg-amber-400' : 'bg-blue-500')}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Category breakdown */}
      {summary.categories.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">By Category</h3>
          <div className="space-y-3">
            {summary.categories.map((cat: CategoryBudgetItem) => {
              const pct = summary.totalSpent > 0 ? Math.round((cat.actualAmount / summary.totalSpent) * 100) : 0
              const budgetOver = cat.expectedAmount && cat.actualAmount > cat.expectedAmount
              return (
                <div key={cat.categoryId}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-1.5">
                      {cat.categoryColor && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.categoryColor }} />}
                      <span className="text-gray-700">{cat.categoryName}</span>
                      {budgetOver && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Over</span>}
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-medium">{fmt(cat.actualAmount)}</span>
                      {cat.expectedAmount && (
                        <span className="text-xs text-gray-400 ml-1">/ {fmt(cat.expectedAmount)}</span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={clsx('h-full rounded-full', budgetOver ? 'bg-red-400' : 'bg-blue-500')}
                      style={{ width: `${pct}%`, backgroundColor: cat.categoryColor ?? undefined }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Member breakdown */}
      {summary.members.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">By Member</h3>
          <div className="space-y-3">
            {summary.members.map(m => {
              const pct = summary.totalSpent > 0 ? Math.round((m.amount / summary.totalSpent) * 100) : 0
              return (
                <div key={m.userId}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white">
                        {m.displayName[0].toUpperCase()}
                      </div>
                      <span className="text-gray-700">{m.displayName}</span>
                      <span className="text-gray-400 text-xs">({m.count} txns)</span>
                    </div>
                    <span className="font-mono font-medium">{fmt(m.amount)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main detail page ──────────────────────────────────────────────────────────

type TabId = 'list' | 'board' | 'summary'

const TABS: { id: TabId; label: string; Icon: typeof List }[] = [
  { id: 'list',    label: 'List',    Icon: List },
  { id: 'board',   label: 'Board',   Icon: LayoutGrid },
  { id: 'summary', label: 'Summary', Icon: BarChart2 },
]

export default function ViewDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabId>('list')

  const { data: view, isLoading } = useQuery<ViewResponse>({
    queryKey: ['view', id],
    queryFn: () => getView(id!),
    enabled: !!id,
  })

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  if (!view) return null

  const pct = view.totalBudget && view.totalBudget > 0
    ? Math.min(100, Math.round((view.totalSpent / view.totalBudget) * 100))
    : null

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Back + header */}
      <button onClick={() => navigate('/views')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> Views
      </button>

      <div className="flex items-start gap-3 mb-2">
        {view.color && <span className="w-4 h-4 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: view.color }} />}
        <div>
          <h1 className="text-xl font-bold text-gray-900">{view.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{fmtDate(view.startDate)} — {fmtDate(view.endDate)}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-sm mb-5">
        <span className="font-semibold text-gray-900">{fmt(view.totalSpent)} spent</span>
        {view.totalBudget && <span className="text-gray-400">of {fmt(view.totalBudget)} budget ({pct}%)</span>}
        <span className="text-gray-400">{view.transactionCount} transactions</span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {TABS.map(({ id: tid, label, Icon }) => (
          <button
            key={tid}
            onClick={() => setTab(tid)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === tid
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'list'    && <ListTab    viewId={id!} />}
      {tab === 'board'   && <BoardTab   viewId={id!} />}
      {tab === 'summary' && <SummaryTab viewId={id!} />}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build --prefix frontend 2>&1 | tail -5
```

Expected: no type errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ViewDetailPage.tsx
git commit -m "feat: add ViewDetailPage with List, Board, and Summary tabs"
```

---

## Task 10: Wire Routing and Nav

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Add routes in `App.tsx`**

Add these two import lines after the existing page imports (after `import SettingsPage`):

```typescript
import ViewsPage from './pages/ViewsPage'
import ViewDetailPage from './pages/ViewDetailPage'
```

Inside the `<Route path="/" ...>` block, add after `<Route path="settings" ...>`:

```tsx
          <Route path="views" element={<ViewsPage />} />
          <Route path="views/:id" element={<ViewDetailPage />} />
```

The full inner route block should be:
```tsx
          <Route index element={<DashboardPage />} />
          <Route path="accounts" element={<BankAccountsPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="transactions" element={<TransactionPage />} />
          <Route path="budgets" element={<BudgetPage />} />
          <Route path="household" element={<HouseholdPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="views" element={<ViewsPage />} />
          <Route path="views/:id" element={<ViewDetailPage />} />
```

- [ ] **Step 2: Add Views to the nav in `Layout.tsx`**

Add this import at the top among existing lucide imports:

```typescript
  LayoutGrid,
```

Add the Views entry to the `nav` array after the `household` entry:

```typescript
  { to: '/views',       label: 'Views',        icon: LayoutGrid },
```

The full `nav` array should be:
```typescript
const nav = [
  { to: '/',             label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/accounts',     label: 'Accounts',     icon: Building2 },
  { to: '/import',       label: 'Import',       icon: Upload },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budgets',      label: 'Budgets',      icon: PiggyBank },
  { to: '/household',    label: 'Household',    icon: Users },
  { to: '/views',        label: 'Views',        icon: LayoutGrid },
  { to: '/settings',     label: 'Settings',     icon: Settings },
]
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build --prefix frontend 2>&1 | tail -5
```

Expected: no type errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat: wire /views and /views/:id routes, add Views nav link"
```

---

## Task 11: "Add to View" on Transactions Page

**Files:**
- Modify: `frontend/src/pages/TransactionPage.tsx`

This adds a bookmark icon button on each transaction row. Clicking it opens a small overlay to pick a view. The transaction is then POSTed to that view.

- [ ] **Step 1: Add imports to `TransactionPage.tsx`**

At the top of the file, add to the existing lucide import line (add `Bookmark` and `BookmarkCheck`):

```typescript
import {
  Search, ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, Check, X, CircleDot,
  Bookmark,
} from 'lucide-react'
```

Add a new API import after the existing import block:

```typescript
import { listViews, addTransactionsToView, type ViewResponse } from '../api/views'
```

- [ ] **Step 2: Add "Add to View" modal component inside `TransactionPage.tsx`**

Add this component before the `TransactionRow` component (before the existing `function TransactionRow`):

```tsx
function AddToViewPicker({
  txId,
  onClose,
}: {
  txId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: views = [] } = useQuery<ViewResponse[]>({
    queryKey: ['views'],
    queryFn: listViews,
  })

  const addMut = useMutation({
    mutationFn: (viewId: string) => addTransactionsToView(viewId, [txId]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['views'] })
      onClose()
    },
  })

  return (
    <div className="absolute z-40 right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-1">
      <p className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Add to view</p>
      {views.length === 0 && (
        <p className="px-3 py-2 text-sm text-gray-400">No views yet</p>
      )}
      {views.map(v => (
        <button
          key={v.id}
          onClick={() => addMut.mutate(v.id)}
          disabled={addMut.isPending}
          className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {v.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: v.color }} />}
          <span className="truncate">{v.name}</span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Add picker state and button to `TransactionRow`**

In the `TransactionRow` function, after the existing state declarations (after `const [pickerOpen, setPickerOpen] = useState(false)` and `const [rulePrompt, setRulePrompt]` etc), add:

```typescript
  const [viewPickerOpen, setViewPickerOpen] = useState(false)
```

In the JSX, find the `{/* Reviewed */}` `<td>` and add a new `<td>` **after** it (as a new 9th column):

```tsx
        {/* Add to view */}
        <td className="px-2 py-3 text-center relative">
          <button
            onClick={() => setViewPickerOpen(v => !v)}
            className="p-1 text-gray-300 hover:text-blue-500 rounded transition-colors"
            title="Add to view"
          >
            <Bookmark className="w-4 h-4" />
          </button>
          {viewPickerOpen && (
            <AddToViewPicker txId={tx.id} onClose={() => setViewPickerOpen(false)} />
          )}
        </td>
```

- [ ] **Step 4: Add the 9th column header**

Find the table `<thead>` in `TransactionPage.tsx`. After the `<th>` for "Reviewed", add:

```tsx
              <th className="px-2 py-3"></th>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npm run build --prefix frontend 2>&1 | tail -5
```

Expected: no type errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/TransactionPage.tsx
git commit -m "feat: add 'Add to view' bookmark action on transaction rows"
```

---

## Task 12: Final Build Verification and Push

- [ ] **Step 1: Full backend build**

```bash
mvn -f backend/pom.xml package -DskipTests -q
```

Expected: `BUILD SUCCESS`

- [ ] **Step 2: Full frontend build**

```bash
npm run build --prefix frontend
```

Expected: `✓ built in Xs` with no errors

- [ ] **Step 3: Push to trigger CI**

```bash
git push origin main
```

Expected: push succeeds; GitHub Actions CI passes both backend and frontend build steps

---

## Self-Review Checklist

### Spec coverage

| Spec requirement | Covered by task |
|---|---|
| `spend_view` table with household, dates, type, color, budget | Task 1 |
| `view_transaction` many-to-many join table | Task 1 |
| `view_category_budget` table | Task 1 |
| TRIP / EVENT / CUSTOM type enum | Task 2 |
| CRUD `/api/views` endpoints | Tasks 5 + 6 |
| Auto-tag household transactions on create | Task 5 (`createView`) |
| POST `/api/views/{id}/transactions` — add transaction(s) | Tasks 5 + 6 |
| DELETE `/api/views/{id}/transactions/{txId}` — remove | Tasks 5 + 6 |
| GET `/api/views/{id}/summary` — totals, category, member | Tasks 5 + 6 |
| Template pre-fill: TRIP categories | Task 7 (`TRIP_TEMPLATE`) |
| Template pre-fill: EVENT categories | Task 7 (`EVENT_TEMPLATE`) |
| Views page: card grid | Task 8 |
| Create flow: name → type → template → date range → budget | Task 8 (CreateViewModal) |
| View detail: List sub-view (paginated + remove) | Task 9 (ListTab) |
| View detail: Board sub-view (columns per category) | Task 9 (BoardTab) |
| View detail: Summary sub-view (gauge + category bars + member cards) | Task 9 (SummaryTab) |
| Views nav tab | Task 10 |
| "Add to view" action on Transactions page | Task 11 |

All spec requirements covered. ✓

### Type consistency check

- `ViewTransactionItem.id` used as `txId` in `removeTransactionFromView` — consistent ✓
- `ViewResponse.id` passed to `navigate('/views/${view.id}')` — consistent ✓  
- `CategoryBudgetItem.actualAmount` (not `amount`) used throughout Summary tab — consistent ✓
- `MemberBreakdown.count` is `number` in TS, `Long` in Java — Jackson serializes Long as JSON number ✓

### Placeholder scan

No TODOs, TBDs, or vague "handle edge cases" instructions found. All code blocks are complete. ✓
