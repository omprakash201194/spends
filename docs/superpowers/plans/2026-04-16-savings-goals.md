# Phase 22 — Savings Goals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users create named savings targets (e.g., "Emergency Fund", "Vacation") and automatically track progress using cumulative net savings (deposits minus withdrawals) from a chosen start date.

**Architecture:** A new `savings_goal` table scoped per user (like `budget`) stores goal name, target amount, and date range. Progress is computed on-the-fly at query time by reusing the existing `TransactionRepository.sumDeposits` and `sumWithdrawals` queries over the goal's date range — no new SQL aggregates needed. Frontend adds a `/goals` page with a card grid + inline create form, and a banner on the Dashboard linking to it.

**Tech Stack:** Spring Boot 3.3.4 / Java 21 / JPA / Liquibase (migration 010) · React 18 / TypeScript / TanStack Query v5 / Tailwind CSS 3 · lucide-react (`Target` icon)

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `backend/src/main/resources/db/changelog/changes/010-savings-goals.sql` | `savings_goal` table + user FK + index |
| Modify | `backend/src/main/resources/db/changelog/db.changelog-master.xml` | Register migration 010 |
| Create | `backend/src/main/java/com/omprakashgautam/homelab/spends/model/SavingsGoal.java` | JPA entity |
| Create | `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/SavingsGoalRepository.java` | findAllByUserId, JpaRepository |
| Create | `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/SavingsGoalDto.java` | CreateRequest + GoalResponse records |
| Create | `backend/src/main/java/com/omprakashgautam/homelab/spends/service/SavingsGoalService.java` | list, create, delete; progress computed from tx repo |
| Create | `backend/src/test/java/com/omprakashgautam/homelab/spends/service/SavingsGoalServiceTest.java` | 5 Mockito unit tests |
| Create | `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/SavingsGoalController.java` | GET/POST/DELETE `/api/goals` |
| Create | `frontend/src/api/savingsGoals.ts` | Axios wrappers for 3 endpoints |
| Create | `frontend/src/pages/GoalsPage.tsx` | Card grid + inline create form + loading/empty states |
| Modify | `frontend/src/App.tsx` | Add `/goals` route |
| Modify | `frontend/src/components/Layout.tsx` | Add Goals nav entry (Target icon, between Budgets and Household) |
| Modify | `frontend/src/pages/DashboardPage.tsx` | Add goals query + green banner showing active/achieved count |

---

## Task 1: DB migration, JPA entity, repository

**Files:**
- Create: `backend/src/main/resources/db/changelog/changes/010-savings-goals.sql`
- Modify: `backend/src/main/resources/db/changelog/db.changelog-master.xml`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/model/SavingsGoal.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/SavingsGoalRepository.java`

- [ ] **Step 1: Create migration 010**

Create `backend/src/main/resources/db/changelog/changes/010-savings-goals.sql`:

```sql
-- liquibase formatted sql

-- changeset omprakash:010-savings-goals

CREATE TABLE savings_goal (
    id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID           NOT NULL REFERENCES app_user(id),
    name        VARCHAR(100)   NOT NULL,
    target      NUMERIC(15, 2) NOT NULL CHECK (target > 0),
    start_date  DATE           NOT NULL,
    target_date DATE,
    created_at  TIMESTAMP      NOT NULL DEFAULT now()
);

CREATE INDEX idx_savings_goal_user ON savings_goal(user_id);
```

- [ ] **Step 2: Register migration in changelog master**

Open `backend/src/main/resources/db/changelog/db.changelog-master.xml`.

Add one line after the existing `009` include:

```xml
    <include file="changes/010-savings-goals.sql" relativeToChangelogFile="true"/>
```

The file should end like this:

```xml
    <include file="changes/009-category-fk-set-null.sql" relativeToChangelogFile="true"/>
    <include file="changes/010-savings-goals.sql" relativeToChangelogFile="true"/>

</databaseChangeLog>
```

- [ ] **Step 3: Create the JPA entity**

Create `backend/src/main/java/com/omprakashgautam/homelab/spends/model/SavingsGoal.java`:

```java
package com.omprakashgautam.homelab.spends.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "savings_goal")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SavingsGoal {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    private User user;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal target;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "target_date")
    private LocalDate targetDate;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
```

- [ ] **Step 4: Create the repository**

Create `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/SavingsGoalRepository.java`:

```java
package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.SavingsGoal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SavingsGoalRepository extends JpaRepository<SavingsGoal, UUID> {

    List<SavingsGoal> findAllByUserIdOrderByCreatedAtAsc(UUID userId);
}
```

- [ ] **Step 5: Run backend tests to confirm nothing is broken**

```bash
mvn -f backend/pom.xml test
```

Expected: `BUILD SUCCESS` — existing tests still pass (migration runs in-memory via H2/Liquibase, entity is a new table, no existing code touched).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/resources/db/changelog/changes/010-savings-goals.sql \
        backend/src/main/resources/db/changelog/db.changelog-master.xml \
        backend/src/main/java/com/omprakashgautam/homelab/spends/model/SavingsGoal.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/repository/SavingsGoalRepository.java
git commit -m "feat: savings_goal table, JPA entity, and repository (migration 010)"
```

---

## Task 2: DTO, service, and unit tests

**Files:**
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/SavingsGoalDto.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/SavingsGoalService.java`
- Create: `backend/src/test/java/com/omprakashgautam/homelab/spends/service/SavingsGoalServiceTest.java`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/test/java/com/omprakashgautam/homelab/spends/service/SavingsGoalServiceTest.java`:

```java
package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.SavingsGoalDto;
import com.omprakashgautam.homelab.spends.model.SavingsGoal;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.SavingsGoalRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SavingsGoalServiceTest {

    @Mock SavingsGoalRepository goalRepository;
    @Mock TransactionRepository  transactionRepository;
    @Mock UserRepository         userRepository;

    @InjectMocks SavingsGoalService service;

    static final UUID USER_ID = UUID.randomUUID();

    @Test
    void listGoals_computesProgressFromNetSavings() {
        SavingsGoal goal = SavingsGoal.builder()
                .id(UUID.randomUUID())
                .user(User.builder().id(USER_ID).build())
                .name("Emergency Fund")
                .target(new BigDecimal("50000"))
                .startDate(LocalDate.of(2025, 1, 1))
                .targetDate(null)
                .build();
        when(goalRepository.findAllByUserIdOrderByCreatedAtAsc(USER_ID)).thenReturn(List.of(goal));
        when(transactionRepository.sumDeposits(eq(USER_ID), eq(LocalDate.of(2025, 1, 1)), any()))
                .thenReturn(new BigDecimal("30000"));
        when(transactionRepository.sumWithdrawals(eq(USER_ID), eq(LocalDate.of(2025, 1, 1)), any()))
                .thenReturn(new BigDecimal("15000"));

        List<SavingsGoalDto.GoalResponse> result = service.listGoals(USER_ID);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).saved()).isEqualByComparingTo("15000");
        assertThat(result.get(0).percentage()).isEqualTo(30);  // 15000/50000
        assertThat(result.get(0).achieved()).isFalse();
    }

    @Test
    void listGoals_capsPercentageAt100WhenOverTarget() {
        SavingsGoal goal = SavingsGoal.builder()
                .id(UUID.randomUUID())
                .user(User.builder().id(USER_ID).build())
                .name("Vacation")
                .target(new BigDecimal("10000"))
                .startDate(LocalDate.of(2025, 1, 1))
                .targetDate(null)
                .build();
        when(goalRepository.findAllByUserIdOrderByCreatedAtAsc(USER_ID)).thenReturn(List.of(goal));
        when(transactionRepository.sumDeposits(any(), any(), any()))
                .thenReturn(new BigDecimal("25000"));
        when(transactionRepository.sumWithdrawals(any(), any(), any()))
                .thenReturn(new BigDecimal("5000")); // net = 20000 > 10000

        List<SavingsGoalDto.GoalResponse> result = service.listGoals(USER_ID);

        assertThat(result.get(0).percentage()).isEqualTo(100);
        assertThat(result.get(0).achieved()).isTrue();
    }

    @Test
    void listGoals_clampsNegativeNetSavingsToZero() {
        SavingsGoal goal = SavingsGoal.builder()
                .id(UUID.randomUUID())
                .user(User.builder().id(USER_ID).build())
                .name("Laptop Fund")
                .target(new BigDecimal("80000"))
                .startDate(LocalDate.of(2025, 1, 1))
                .targetDate(null)
                .build();
        when(goalRepository.findAllByUserIdOrderByCreatedAtAsc(USER_ID)).thenReturn(List.of(goal));
        when(transactionRepository.sumDeposits(any(), any(), any()))
                .thenReturn(new BigDecimal("10000"));
        when(transactionRepository.sumWithdrawals(any(), any(), any()))
                .thenReturn(new BigDecimal("15000")); // net = -5000

        List<SavingsGoalDto.GoalResponse> result = service.listGoals(USER_ID);

        assertThat(result.get(0).saved()).isEqualByComparingTo("0");
        assertThat(result.get(0).percentage()).isEqualTo(0);
    }

    @Test
    void createGoal_savesEntityAndReturnsResponse() {
        SavingsGoalDto.CreateRequest req = new SavingsGoalDto.CreateRequest(
                "House Down Payment", new BigDecimal("500000"),
                LocalDate.of(2025, 1, 1), LocalDate.of(2026, 12, 31));
        User user = User.builder().id(USER_ID).build();
        when(userRepository.getReferenceById(USER_ID)).thenReturn(user);
        SavingsGoal saved = SavingsGoal.builder()
                .id(UUID.randomUUID())
                .user(user)
                .name(req.name())
                .target(req.target())
                .startDate(req.startDate())
                .targetDate(req.targetDate())
                .build();
        when(goalRepository.save(any())).thenReturn(saved);
        when(transactionRepository.sumDeposits(any(), any(), any())).thenReturn(BigDecimal.ZERO);
        when(transactionRepository.sumWithdrawals(any(), any(), any())).thenReturn(BigDecimal.ZERO);

        SavingsGoalDto.GoalResponse result = service.createGoal(USER_ID, req);

        assertThat(result.name()).isEqualTo("House Down Payment");
        assertThat(result.target()).isEqualByComparingTo("500000");
        assertThat(result.saved()).isEqualByComparingTo("0");
        assertThat(result.achieved()).isFalse();
    }

    @Test
    void deleteGoal_throwsForbiddenIfNotOwner() {
        UUID goalId = UUID.randomUUID();
        SavingsGoal goal = SavingsGoal.builder()
                .id(goalId)
                .user(User.builder().id(UUID.randomUUID()).build()) // different owner
                .name("Not mine")
                .target(BigDecimal.TEN)
                .startDate(LocalDate.now())
                .build();
        when(goalRepository.findById(goalId)).thenReturn(Optional.of(goal));

        assertThatThrownBy(() -> service.deleteGoal(USER_ID, goalId))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.FORBIDDEN));
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
mvn -f backend/pom.xml test -Dtest=SavingsGoalServiceTest
```

Expected: `COMPILATION ERROR` — `SavingsGoalService` and `SavingsGoalDto` do not exist yet.

- [ ] **Step 3: Create the DTO**

Create `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/SavingsGoalDto.java`:

```java
package com.omprakashgautam.homelab.spends.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public class SavingsGoalDto {

    public record CreateRequest(
            String name,
            BigDecimal target,
            LocalDate startDate,
            LocalDate targetDate   // nullable — no deadline
    ) {}

    public record GoalResponse(
            UUID id,
            String name,
            BigDecimal target,
            LocalDate startDate,
            LocalDate targetDate,  // nullable
            BigDecimal saved,      // net savings clamped to >= 0
            int percentage,        // 0–100, capped at 100
            boolean achieved       // saved >= target
    ) {}
}
```

- [ ] **Step 4: Create the service**

Create `backend/src/main/java/com/omprakashgautam/homelab/spends/service/SavingsGoalService.java`:

```java
package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.SavingsGoalDto;
import com.omprakashgautam.homelab.spends.model.SavingsGoal;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.SavingsGoalRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SavingsGoalService {

    private final SavingsGoalRepository goalRepository;
    private final TransactionRepository  transactionRepository;
    private final UserRepository         userRepository;

    @Transactional(readOnly = true)
    public List<SavingsGoalDto.GoalResponse> listGoals(UUID userId) {
        return goalRepository.findAllByUserIdOrderByCreatedAtAsc(userId)
                .stream()
                .map(g -> toResponse(g, userId))
                .toList();
    }

    @Transactional
    public SavingsGoalDto.GoalResponse createGoal(UUID userId, SavingsGoalDto.CreateRequest req) {
        User user = userRepository.getReferenceById(userId);
        SavingsGoal goal = SavingsGoal.builder()
                .user(user)
                .name(req.name())
                .target(req.target())
                .startDate(req.startDate())
                .targetDate(req.targetDate())
                .build();
        return toResponse(goalRepository.save(goal), userId);
    }

    @Transactional
    public void deleteGoal(UUID userId, UUID goalId) {
        SavingsGoal goal = goalRepository.findById(goalId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found"));
        if (!goal.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        goalRepository.delete(goal);
    }

    /**
     * Computes progress by summing deposits - withdrawals from the goal's startDate
     * to today (or the targetDate if it has already passed). Net savings is clamped
     * to zero and percentage capped at 100.
     */
    private SavingsGoalDto.GoalResponse toResponse(SavingsGoal goal, UUID userId) {
        LocalDate today   = LocalDate.now();
        LocalDate endDate = (goal.getTargetDate() != null && goal.getTargetDate().isBefore(today))
                ? goal.getTargetDate() : today;

        BigDecimal deposits    = transactionRepository.sumDeposits(userId, goal.getStartDate(), endDate);
        BigDecimal withdrawals = transactionRepository.sumWithdrawals(userId, goal.getStartDate(), endDate);
        BigDecimal saved       = deposits.subtract(withdrawals).max(BigDecimal.ZERO);

        int pct = 0;
        if (goal.getTarget().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal rawPct = saved.multiply(BigDecimal.valueOf(100))
                    .divide(goal.getTarget(), 0, RoundingMode.HALF_UP);
            pct = rawPct.min(BigDecimal.valueOf(100)).intValue();
        }
        boolean achieved = saved.compareTo(goal.getTarget()) >= 0;

        return new SavingsGoalDto.GoalResponse(
                goal.getId(), goal.getName(), goal.getTarget(),
                goal.getStartDate(), goal.getTargetDate(),
                saved, pct, achieved
        );
    }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
mvn -f backend/pom.xml test -Dtest=SavingsGoalServiceTest
```

Expected: `Tests run: 5, Failures: 0, Errors: 0, Skipped: 0` — `BUILD SUCCESS`

- [ ] **Step 6: Run all tests**

```bash
mvn -f backend/pom.xml test
```

Expected: `BUILD SUCCESS` — all existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/dto/SavingsGoalDto.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/service/SavingsGoalService.java \
        backend/src/test/java/com/omprakashgautam/homelab/spends/service/SavingsGoalServiceTest.java
git commit -m "feat: SavingsGoalService with net-savings progress calculation (5 tests)"
```

---

## Task 3: REST controller

**Files:**
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/SavingsGoalController.java`

- [ ] **Step 1: Create the controller**

Create `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/SavingsGoalController.java`:

```java
package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.SavingsGoalDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.SavingsGoalService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/goals")
@RequiredArgsConstructor
public class SavingsGoalController {

    private final SavingsGoalService savingsGoalService;

    @GetMapping
    public ResponseEntity<List<SavingsGoalDto.GoalResponse>> listGoals(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        return ResponseEntity.ok(savingsGoalService.listGoals(principal.getId()));
    }

    @PostMapping
    public ResponseEntity<SavingsGoalDto.GoalResponse> createGoal(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestBody SavingsGoalDto.CreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(savingsGoalService.createGoal(principal.getId(), request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteGoal(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID id) {
        savingsGoalService.deleteGoal(principal.getId(), id);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 2: Run all backend tests**

```bash
mvn -f backend/pom.xml test
```

Expected: `BUILD SUCCESS`

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/controller/SavingsGoalController.java
git commit -m "feat: SavingsGoalController — GET/POST/DELETE /api/goals"
```

---

## Task 4: Frontend API client and Goals page

**Files:**
- Create: `frontend/src/api/savingsGoals.ts`
- Create: `frontend/src/pages/GoalsPage.tsx`

- [ ] **Step 1: Create the API client**

Create `frontend/src/api/savingsGoals.ts`:

```typescript
import apiClient from './client'

export interface GoalResponse {
  id: string
  name: string
  target: number
  startDate: string        // "2025-01-01"
  targetDate: string | null
  saved: number
  percentage: number       // 0–100
  achieved: boolean
}

export interface CreateGoalRequest {
  name: string
  target: number
  startDate: string        // "2025-01-01"
  targetDate: string | null
}

export async function getGoals(): Promise<GoalResponse[]> {
  const { data } = await apiClient.get<GoalResponse[]>('/goals')
  return data
}

export async function createGoal(req: CreateGoalRequest): Promise<GoalResponse> {
  const { data } = await apiClient.post<GoalResponse>('/goals', req)
  return data
}

export async function deleteGoal(id: string): Promise<void> {
  await apiClient.delete(`/goals/${id}`)
}
```

- [ ] **Step 2: Create GoalsPage.tsx**

Create `frontend/src/pages/GoalsPage.tsx`:

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Target, Plus, Trash2, CheckCircle2, Clock, X } from 'lucide-react'
import {
  getGoals, createGoal, deleteGoal,
  type GoalResponse, type CreateGoalRequest,
} from '../api/savingsGoals'

// ── Helpers ───────────────────────────────────────────────────────────────────

function inrFull(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function daysRemaining(targetDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(targetDate)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const [showForm, setShowForm] = useState(false)

  const { data: goals = [], isLoading, isError } = useQuery({
    queryKey: ['goals'],
    queryFn: getGoals,
    staleTime: 60_000,
  })

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Savings Goals
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track progress toward financial targets using your net savings
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Goal
        </button>
      </div>

      {showForm && <CreateGoalForm onDone={() => setShowForm(false)} />}

      {isLoading && <LoadingSkeleton />}

      {isError && (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          Failed to load goals. Please refresh.
        </div>
      )}

      {!isLoading && !isError && goals.length === 0 && !showForm && (
        <EmptyState onAdd={() => setShowForm(true)} />
      )}

      {goals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {goals.map(goal => <GoalCard key={goal.id} goal={goal} />)}
        </div>
      )}
    </div>
  )
}

// ── Create form ────────────────────────────────────────────────────────────────

function CreateGoalForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState<CreateGoalRequest>({
    name: '',
    target: 0,
    startDate: today,
    targetDate: null,
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: createGoal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      onDone()
    },
    onError: () => setError('Failed to create goal. Please try again.'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Goal name is required'); return }
    if (form.target <= 0)  { setError('Target amount must be greater than 0'); return }
    setError('')
    mutation.mutate(form)
  }

  const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 mb-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">New savings goal</h2>
        <button
          type="button"
          onClick={onDone}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelCls}>Goal name</label>
          <input
            type="text"
            placeholder="e.g. Emergency Fund, Vacation, New Laptop"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            maxLength={100}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Target amount (₹)</label>
          <input
            type="number"
            min="1"
            placeholder="50000"
            value={form.target || ''}
            onChange={e => setForm(f => ({ ...f, target: Number(e.target.value) }))}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Start tracking from</label>
          <input
            type="date"
            value={form.startDate}
            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>
            Target date <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            type="date"
            value={form.targetDate ?? ''}
            onChange={e => setForm(f => ({ ...f, targetDate: e.target.value || null }))}
            className={inputCls}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{error}</p>}

      <div className="flex gap-3 mt-4">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {mutation.isPending ? 'Creating…' : 'Create Goal'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Goal card ─────────────────────────────────────────────────────────────────

function GoalCard({ goal }: { goal: GoalResponse }) {
  const qc = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => deleteGoal(goal.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })

  const days = goal.targetDate ? daysRemaining(goal.targetDate) : null

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      {/* Header row */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {goal.achieved
            ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            : <Target className="w-5 h-5 text-blue-500 flex-shrink-0" />
          }
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight truncate">
            {goal.name}
          </h3>
        </div>

        {confirmDelete ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>{inrFull(goal.saved)} saved</span>
          <span>{goal.percentage}%</span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              goal.achieved ? 'bg-emerald-500' : 'bg-blue-500'
            }`}
            style={{ width: `${goal.percentage}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Target: {inrFull(goal.target)}
        </p>
      </div>

      {/* Status badge */}
      {goal.achieved ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
          <CheckCircle2 className="w-3 h-3" /> Achieved!
        </span>
      ) : days !== null ? (
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
          days < 0
            ? 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950'
            : days <= 30
              ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950'
              : 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700'
        }`}>
          <Clock className="w-3 h-3" />
          {days < 0 ? `${Math.abs(days)} days overdue` : `${days} days left`}
        </span>
      ) : (
        <span className="text-xs text-gray-400 dark:text-gray-500">No deadline set</span>
      )}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-16">
      <Target className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
      <p className="text-gray-500 dark:text-gray-400 mb-4">No savings goals yet</p>
      <button
        onClick={onAdd}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Create your first goal
      </button>
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 animate-pulse"
        >
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4" />
          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full mb-2" />
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/2" />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/savingsGoals.ts frontend/src/pages/GoalsPage.tsx
git commit -m "feat: savingsGoals API client and GoalsPage with create form and progress cards"
```

---

## Task 5: Route wiring, nav entry, and Dashboard banner

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Add route to App.tsx**

Open `frontend/src/App.tsx`.

Add the import after the existing page imports:

```tsx
import GoalsPage from './pages/GoalsPage'
```

Add the route inside the protected Layout route, after the `data-health` route and before `settings`:

```tsx
<Route path="data-health" element={<DataHealthPage />} />
<Route path="goals" element={<GoalsPage />} />
<Route path="settings" element={<SettingsPage />} />
```

- [ ] **Step 2: Add Goals nav entry to Layout.tsx**

Open `frontend/src/components/Layout.tsx`.

Add `Target` to the lucide-react import:

```tsx
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  Settings,
  LogOut,
  TrendingUp,
  Building2,
  Upload,
  Users,
  Menu,
  X,
  LayoutGrid,
  Repeat,
  FileText,
  Moon,
  Sun,
  ShieldCheck,
  Target,
} from 'lucide-react'
```

Add the Goals entry to the `nav` array between Budgets and Household:

```tsx
const nav = [
  { to: '/',             label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/accounts',     label: 'Accounts',     icon: Building2 },
  { to: '/import',       label: 'Import',       icon: Upload },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budgets',      label: 'Budgets',      icon: PiggyBank },
  { to: '/goals',        label: 'Goals',        icon: Target },
  { to: '/household',    label: 'Household',    icon: Users },
  { to: '/views',        label: 'Views',        icon: LayoutGrid },
  { to: '/recurring',    label: 'Recurring',    icon: Repeat },
  { to: '/reports',      label: 'Reports',      icon: FileText },
  { to: '/data-health',  label: 'Data Health',  icon: ShieldCheck },
  { to: '/settings',     label: 'Settings',     icon: Settings },
]
```

- [ ] **Step 3: Add goals banner to DashboardPage.tsx**

Open `frontend/src/pages/DashboardPage.tsx`.

Add the import after the existing api imports:

```tsx
import { getGoals, type GoalResponse } from '../api/savingsGoals'
```

Add `Target` to the lucide-react import (it already imports many icons — add it to the list):

```tsx
import {
  TrendingDown, TrendingUp, Wallet, BarChart3, ShoppingBag, ArrowRight,
  AlertTriangle, Sparkles, ChevronDown, ChevronUp, Repeat, Target,
} from 'lucide-react'
```

Add the goals query inside the `DashboardPage` component, after the `recurringData` query:

```tsx
const { data: goalsData } = useQuery<GoalResponse[]>({
  queryKey: ['goals'],
  queryFn: getGoals,
  staleTime: 60_000,
})
```

Pass `goalsData` to `DashboardContent`. Find the line:

```tsx
{data && <DashboardContent data={data} alertData={alertData} recurringData={recurringData} />}
```

Replace it with:

```tsx
{data && <DashboardContent data={data} alertData={alertData} recurringData={recurringData} goalsData={goalsData} />}
```

Update the `DashboardContent` function signature to accept `goalsData`:

```tsx
function DashboardContent({ data, alertData, recurringData, goalsData }: {
  data: DashboardSummary
  alertData?: AlertSummary
  recurringData?: RecurringSummary
  goalsData?: GoalResponse[]
}) {
```

Add the goals banner inside `DashboardContent`, after the recurring patterns banner (after the closing `}` of the recurring `{recurringData && ...}` block):

```tsx
{goalsData && goalsData.length > 0 && (
  <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 flex items-center justify-between mb-6">
    <div className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-300">
      <Target className="w-4 h-4 text-emerald-600 flex-shrink-0" />
      <span>
        <span className="font-semibold">{goalsData.filter(g => g.achieved).length}</span>
        {' '}of{' '}
        <span className="font-semibold">{goalsData.length}</span>
        {' '}savings {goalsData.length === 1 ? 'goal' : 'goals'} achieved
      </span>
    </div>
    <Link
      to="/goals"
      className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 flex-shrink-0 ml-4"
    >
      View all <ArrowRight className="w-3 h-3" />
    </Link>
  </div>
)}
```

- [ ] **Step 4: Build the frontend to confirm no TypeScript errors**

```bash
cd frontend && npm run build
```

Expected: `✓ built in Xs` — no TypeScript or build errors. Then return: `cd ..`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Layout.tsx frontend/src/pages/DashboardPage.tsx
git commit -m "feat: Goals route, sidebar nav, and Dashboard banner"
```

- [ ] **Step 6: Push to origin**

```bash
git push origin main
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| Create a named savings goal with target amount | Task 4 form, Task 2 service |
| Optional deadline (target date) | Task 1 schema, Task 2 service |
| Start tracking from a user-chosen date | Task 1 schema, Task 2 service |
| Progress = net savings (deposits − withdrawals) | Task 2 `toResponse` |
| Negative net savings clamped to 0 | Task 2, test 3 |
| Percentage capped at 100 | Task 2, test 2 |
| "Achieved" badge when saved ≥ target | Task 4 GoalCard |
| Days remaining / overdue badge | Task 4 GoalCard |
| Delete goal with inline confirmation | Task 4 GoalCard |
| Dashboard banner showing goal summary | Task 5 |
| Sidebar nav entry | Task 5 |

**Placeholder scan:** No TBDs, TODOs, or placeholder text present.

**Type consistency check:**
- `GoalResponse` in `SavingsGoalDto.java` → matches `GoalResponse` interface in `savingsGoals.ts` field-for-field
- `CreateRequest` in `SavingsGoalDto.java` → matches `CreateGoalRequest` in `savingsGoals.ts` (field names identical, sent as JSON)
- `SavingsGoalRepository.findAllByUserIdOrderByCreatedAtAsc` → called in `SavingsGoalService.listGoals` with matching method name
- `transactionRepository.sumDeposits` / `sumWithdrawals` → existing methods in `TransactionRepository`, signatures match usage in `toResponse`
