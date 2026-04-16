# Phase 19 — Settings Danger Zone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Danger Zone tab to the Settings page with individually confirmed bulk-delete actions for transactions, rules, budgets, views, and custom categories.

**Architecture:** A new `DangerZoneController` (`DELETE /api/danger-zone/*`) backed by a `DangerZoneService` that calls through existing repositories (adding 4 new bulk-delete query methods). Frontend adds a `DangerZoneTab` component to `SettingsPage.tsx` with per-action inline confirmation (user must type `DELETE`). No new pages, no new routes — all within Settings.

**Tech Stack:** Spring Boot 3.3.4 / Java 21 · JPQL `@Modifying @Transactional` · React 18 + TypeScript · TanStack Query v5 mutations · Tailwind CSS 3 (dark mode class strategy)

---

## File Map

| Status | Path | Role |
|---|---|---|
| Modify | `backend/src/main/java/.../repository/CategoryRuleRepository.java` | Add `deleteAllByUserId` bulk-delete |
| Modify | `backend/src/main/java/.../repository/BudgetRepository.java` | Add `deleteAllByUserId` bulk-delete |
| Modify | `backend/src/main/java/.../repository/ViewRepository.java` | Add `deleteAllByHouseholdId` bulk-delete |
| Modify | `backend/src/main/java/.../repository/CategoryRepository.java` | Add `deleteAllByHouseholdIdAndSystemFalse` bulk-delete |
| Create | `backend/src/main/java/.../service/DangerZoneService.java` | Orchestrates all 5 bulk-delete operations |
| Create | `backend/src/main/java/.../controller/DangerZoneController.java` | `DELETE /api/danger-zone/{resource}` — 5 endpoints |
| Create | `backend/src/test/java/.../service/DangerZoneServiceTest.java` | 5 unit tests (one per operation) |
| Create | `frontend/src/api/dangerZone.ts` | 5 API client functions |
| Modify | `frontend/src/pages/SettingsPage.tsx` | Add `'danger'` tab + `DangerZoneTab` component |

Full package path: `com.omprakashgautam.homelab.spends`

---

## Task 1: Backend bulk-delete repository methods

**Files:**
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/CategoryRuleRepository.java`
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/BudgetRepository.java`
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/ViewRepository.java`
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/CategoryRepository.java`

- [ ] **Step 1: Add `deleteAllByUserId` to CategoryRuleRepository**

Open `CategoryRuleRepository.java`. Add below the existing query methods:

```java
@Modifying
@Transactional
@Query("DELETE FROM CategoryRule r WHERE r.user.id = :userId")
void deleteAllByUserId(@Param("userId") UUID userId);
```

Required import: `org.springframework.data.jpa.repository.Modifying`

- [ ] **Step 2: Add `deleteAllByUserId` to BudgetRepository**

Open `BudgetRepository.java`. Add:

```java
@Modifying
@Transactional
@Query("DELETE FROM Budget b WHERE b.user.id = :userId")
void deleteAllByUserId(@Param("userId") UUID userId);
```

Required imports: `org.springframework.data.jpa.repository.Modifying`, `org.springframework.data.jpa.repository.Query`, `org.springframework.data.repository.query.Param`

- [ ] **Step 3: Add `deleteAllByHouseholdId` to ViewRepository**

Open `ViewRepository.java`. Add:

```java
@Modifying
@Transactional
@Query("DELETE FROM SpendView v WHERE v.household.id = :householdId")
void deleteAllByHouseholdId(@Param("householdId") UUID householdId);
```

Note: `view_transaction` and `view_category_budget` both have `ON DELETE CASCADE` on `view_id` in the DB schema (migration 007), so no manual child cleanup needed.

- [ ] **Step 4: Add `deleteAllByHouseholdIdAndSystemFalse` to CategoryRepository**

Open `CategoryRepository.java`. Add:

```java
@Modifying
@Transactional
@Query("DELETE FROM Category c WHERE c.household.id = :householdId AND c.system = false")
void deleteAllByHouseholdIdAndSystemFalse(@Param("householdId") UUID householdId);
```

- [ ] **Step 5: Compile check**

```bash
cd f:/Development/home-lab/spends/backend && mvn compile -q 2>&1 | tail -5
```

Expected: BUILD SUCCESS (no output for `-q`).

- [ ] **Step 6: Commit**

```bash
cd f:/Development/home-lab/spends && git add backend/src/main/java/com/omprakashgautam/homelab/spends/repository/ && git commit -m "feat: add bulk-delete methods to 4 repositories for danger zone"
```

---

## Task 2: DangerZoneService + DangerZoneController

**Files:**
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/DangerZoneService.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/DangerZoneController.java`

- [ ] **Step 1: Create DangerZoneService**

Create `backend/src/main/java/com/omprakashgautam/homelab/spends/service/DangerZoneService.java`:

```java
package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DangerZoneService {

    private final TransactionRepository   transactionRepository;
    private final ImportBatchRepository   importBatchRepository;
    private final CategoryRuleRepository  categoryRuleRepository;
    private final BudgetRepository        budgetRepository;
    private final ViewRepository          viewRepository;
    private final CategoryRepository      categoryRepository;

    /** Deletes all transactions and their import batches for the user. */
    @Transactional
    public void deleteAllTransactions(UUID userId) {
        transactionRepository.deleteAllByUserId(userId);
        importBatchRepository.deleteAllByUserId(userId);
    }

    /** Deletes all user-owned categorization rules. */
    @Transactional
    public void deleteAllRules(UUID userId) {
        categoryRuleRepository.deleteAllByUserId(userId);
    }

    /** Deletes all budget limits for the user. */
    @Transactional
    public void deleteAllBudgets(UUID userId) {
        budgetRepository.deleteAllByUserId(userId);
    }

    /** Deletes all views (and their transaction links / category budgets via DB cascade) for the household. */
    @Transactional
    public void deleteAllViews(UUID householdId) {
        viewRepository.deleteAllByHouseholdId(householdId);
    }

    /** Deletes all non-system custom categories for the household. */
    @Transactional
    public void deleteAllCustomCategories(UUID householdId) {
        categoryRepository.deleteAllByHouseholdIdAndSystemFalse(householdId);
    }
}
```

- [ ] **Step 2: Create DangerZoneController**

Create `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/DangerZoneController.java`:

```java
package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.DangerZoneService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@RestController
@RequestMapping("/api/danger-zone")
@RequiredArgsConstructor
public class DangerZoneController {

    private final DangerZoneService dangerZoneService;
    private final UserRepository    userRepository;

    @DeleteMapping("/transactions")
    public ResponseEntity<Void> deleteTransactions(@AuthenticationPrincipal UserDetailsImpl principal) {
        dangerZoneService.deleteAllTransactions(principal.getId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/rules")
    public ResponseEntity<Void> deleteRules(@AuthenticationPrincipal UserDetailsImpl principal) {
        dangerZoneService.deleteAllRules(principal.getId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/budgets")
    public ResponseEntity<Void> deleteBudgets(@AuthenticationPrincipal UserDetailsImpl principal) {
        dangerZoneService.deleteAllBudgets(principal.getId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/views")
    public ResponseEntity<Void> deleteViews(@AuthenticationPrincipal UserDetailsImpl principal) {
        UUID householdId = resolveHouseholdId(principal.getId());
        dangerZoneService.deleteAllViews(householdId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/custom-categories")
    public ResponseEntity<Void> deleteCustomCategories(@AuthenticationPrincipal UserDetailsImpl principal) {
        UUID householdId = resolveHouseholdId(principal.getId());
        dangerZoneService.deleteAllCustomCategories(householdId);
        return ResponseEntity.noContent().build();
    }

    private UUID resolveHouseholdId(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        return user.getHousehold().getId();
    }
}
```

- [ ] **Step 3: Compile check**

```bash
cd f:/Development/home-lab/spends/backend && mvn compile -q 2>&1 | tail -5
```

Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
cd f:/Development/home-lab/spends && git add backend/src/main/java/com/omprakashgautam/homelab/spends/service/DangerZoneService.java backend/src/main/java/com/omprakashgautam/homelab/spends/controller/DangerZoneController.java && git commit -m "feat: DangerZoneService + DangerZoneController (5 bulk-delete endpoints)"
```

---

## Task 3: DangerZoneServiceTest

**Files:**
- Create: `backend/src/test/java/com/omprakashgautam/homelab/spends/service/DangerZoneServiceTest.java`

- [ ] **Step 1: Write the tests**

Create `backend/src/test/java/com/omprakashgautam/homelab/spends/service/DangerZoneServiceTest.java`:

```java
package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

@ExtendWith(MockitoExtension.class)
class DangerZoneServiceTest {

    @Mock TransactionRepository   transactionRepository;
    @Mock ImportBatchRepository   importBatchRepository;
    @Mock CategoryRuleRepository  categoryRuleRepository;
    @Mock BudgetRepository        budgetRepository;
    @Mock ViewRepository          viewRepository;
    @Mock CategoryRepository      categoryRepository;

    @InjectMocks DangerZoneService service;

    @Test
    void deleteAllTransactions_callsBothRepositories() {
        UUID userId = UUID.randomUUID();
        service.deleteAllTransactions(userId);
        verify(transactionRepository).deleteAllByUserId(userId);
        verify(importBatchRepository).deleteAllByUserId(userId);
        verifyNoMoreInteractions(categoryRuleRepository, budgetRepository, viewRepository, categoryRepository);
    }

    @Test
    void deleteAllRules_deletesOnlyUserRules() {
        UUID userId = UUID.randomUUID();
        service.deleteAllRules(userId);
        verify(categoryRuleRepository).deleteAllByUserId(userId);
        verifyNoMoreInteractions(transactionRepository, importBatchRepository, budgetRepository, viewRepository, categoryRepository);
    }

    @Test
    void deleteAllBudgets_deletesOnlyUserBudgets() {
        UUID userId = UUID.randomUUID();
        service.deleteAllBudgets(userId);
        verify(budgetRepository).deleteAllByUserId(userId);
        verifyNoMoreInteractions(transactionRepository, importBatchRepository, categoryRuleRepository, viewRepository, categoryRepository);
    }

    @Test
    void deleteAllViews_deletesHouseholdViews() {
        UUID householdId = UUID.randomUUID();
        service.deleteAllViews(householdId);
        verify(viewRepository).deleteAllByHouseholdId(householdId);
        verifyNoMoreInteractions(transactionRepository, importBatchRepository, categoryRuleRepository, budgetRepository, categoryRepository);
    }

    @Test
    void deleteAllCustomCategories_deletesNonSystemCategoriesForHousehold() {
        UUID householdId = UUID.randomUUID();
        service.deleteAllCustomCategories(householdId);
        verify(categoryRepository).deleteAllByHouseholdIdAndSystemFalse(householdId);
        verifyNoMoreInteractions(transactionRepository, importBatchRepository, categoryRuleRepository, budgetRepository, viewRepository);
    }
}
```

- [ ] **Step 2: Run the tests**

```bash
cd f:/Development/home-lab/spends/backend && mvn test -pl . -Dtest=DangerZoneServiceTest -q 2>&1 | tail -10
```

Expected: `Tests run: 5, Failures: 0, Errors: 0, Skipped: 0`

- [ ] **Step 3: Run full test suite**

```bash
cd f:/Development/home-lab/spends/backend && mvn test -q 2>&1 | tail -5
```

Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
cd f:/Development/home-lab/spends && git add backend/src/test/java/com/omprakashgautam/homelab/spends/service/DangerZoneServiceTest.java && git commit -m "test: DangerZoneServiceTest — 5 unit tests covering all bulk-delete operations"
```

---

## Task 4: Frontend — dangerZone API client + DangerZoneTab in Settings

**Files:**
- Create: `frontend/src/api/dangerZone.ts`
- Modify: `frontend/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Create the API client**

Create `frontend/src/api/dangerZone.ts`:

```typescript
import apiClient from './client'

export async function deleteAllTransactions(): Promise<void> {
  await apiClient.delete('/danger-zone/transactions')
}

export async function deleteAllRules(): Promise<void> {
  await apiClient.delete('/danger-zone/rules')
}

export async function deleteAllBudgets(): Promise<void> {
  await apiClient.delete('/danger-zone/budgets')
}

export async function deleteAllViews(): Promise<void> {
  await apiClient.delete('/danger-zone/views')
}

export async function deleteAllCustomCategories(): Promise<void> {
  await apiClient.delete('/danger-zone/custom-categories')
}
```

- [ ] **Step 2: Add `DangerZoneTab` to SettingsPage.tsx**

Open `frontend/src/pages/SettingsPage.tsx`.

**2a — Update the `Tab` type** (line ~24):

```tsx
type Tab = 'apikey' | 'categories' | 'rules' | 'danger'
```

**2b — Add `AlertTriangle` to the lucide-react import** at the top of the file. Change:

```tsx
import { Key, Trash2, Check, ExternalLink, Plus, Pencil, X, Tag, Sliders } from 'lucide-react'
```

to:

```tsx
import { Key, Trash2, Check, ExternalLink, Plus, Pencil, X, Tag, Sliders, AlertTriangle } from 'lucide-react'
```

**2c — Add the danger zone tab to the tabs array** in `SettingsPage`. Find the tabs array that currently ends with `{ id: 'rules', ... }` and add one more entry:

```tsx
{ id: 'danger',     label: 'Danger Zone', icon: AlertTriangle },
```

So the full array becomes:

```tsx
{([
  { id: 'apikey',     label: 'API Key',      icon: Key           },
  { id: 'categories', label: 'Categories',   icon: Tag           },
  { id: 'rules',      label: 'Rules',        icon: Sliders       },
  { id: 'danger',     label: 'Danger Zone',  icon: AlertTriangle },
] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
  <button
    key={id}
    onClick={() => setTab(id)}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      tab === id
        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
    }`}
  >
    <Icon className="w-3.5 h-3.5" />
    {label}
  </button>
))}
```

**2d — Add the tab render** after the `{tab === 'rules' && <RulesTab />}` line:

```tsx
{tab === 'danger'     && <DangerZoneTab />}
```

**2e — Add the import for dangerZone API functions** at the top of the file, after the existing imports:

```tsx
import {
  deleteAllTransactions as apiDeleteTransactions,
  deleteAllRules as apiDeleteRules,
  deleteAllBudgets as apiDeleteBudgets,
  deleteAllViews as apiDeleteViews,
  deleteAllCustomCategories as apiDeleteCustomCategories,
} from '../api/dangerZone'
```

**2f — Add the `DangerZoneTab` component** at the bottom of the file, before the `ColourPicker` component:

```tsx
// ── Tab: Danger Zone ──────────────────────────────────────────────────────────

interface DangerAction {
  key: string
  title: string
  description: string
  mutationFn: () => Promise<void>
  invalidateKeys: string[][]
}

function DangerZoneTab() {
  const qc = useQueryClient()

  const actions: DangerAction[] = [
    {
      key: 'transactions',
      title: 'Delete all transactions',
      description: 'Permanently deletes every transaction and import record across all your bank accounts. This cannot be undone.',
      mutationFn: apiDeleteTransactions,
      invalidateKeys: [['transactions'], ['dashboard'], ['budgets'], ['recurring'], ['import-history'], ['data-health']],
    },
    {
      key: 'rules',
      title: 'Delete all categorization rules',
      description: 'Removes all your keyword rules. Auto-categorization will fall back to the global rules only.',
      mutationFn: apiDeleteRules,
      invalidateKeys: [['category-rules']],
    },
    {
      key: 'budgets',
      title: 'Delete all budget limits',
      description: 'Removes every budget limit you have set. Historical spending data is unaffected.',
      mutationFn: apiDeleteBudgets,
      invalidateKeys: [['budgets']],
    },
    {
      key: 'views',
      title: 'Delete all views',
      description: 'Removes all trip and event views for your household. The underlying transactions are not deleted.',
      mutationFn: apiDeleteViews,
      invalidateKeys: [['views']],
    },
    {
      key: 'custom-categories',
      title: 'Delete all custom categories',
      description: 'Removes all custom categories created by your household. Transactions assigned to them will lose their category.',
      mutationFn: apiDeleteCustomCategories,
      invalidateKeys: [['categories'], ['transactions'], ['data-health']],
    },
  ]

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-5 py-4">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
          <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">Danger Zone</h2>
        </div>
        <p className="text-xs text-red-600 dark:text-red-500">
          These actions are permanent and cannot be undone. Each requires you to type DELETE to confirm.
        </p>
      </div>
      {actions.map(action => (
        <DangerAction
          key={action.key}
          action={action}
          onSuccess={() => action.invalidateKeys.forEach(k => qc.invalidateQueries({ queryKey: k }))}
        />
      ))}
    </div>
  )
}

function DangerAction({
  action,
  onSuccess,
}: {
  action: DangerAction
  onSuccess: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [input, setInput]           = useState('')
  const [done, setDone]             = useState(false)

  const mutation = useMutation({
    mutationFn: action.mutationFn,
    onSuccess: () => {
      onSuccess()
      setConfirming(false)
      setInput('')
      setDone(true)
      setTimeout(() => setDone(false), 4000)
    },
  })

  const cancel = () => {
    setConfirming(false)
    setInput('')
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{action.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{action.description}</p>
        </div>
        {!confirming && !done && (
          <button
            onClick={() => setConfirming(true)}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          >
            Delete
          </button>
        )}
        {done && (
          <span className="flex-shrink-0 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="w-3.5 h-3.5" /> Done
          </span>
        )}
      </div>

      {confirming && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Type <span className="font-mono font-bold text-red-600 dark:text-red-400">DELETE</span> to confirm:
          </p>
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="DELETE"
              className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
              onKeyDown={e => {
                if (e.key === 'Enter' && input === 'DELETE') mutation.mutate()
                if (e.key === 'Escape') cancel()
              }}
            />
            <button
              onClick={() => mutation.mutate()}
              disabled={input !== 'DELETE' || mutation.isPending}
              className="px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-40 transition-colors"
            >
              {mutation.isPending ? '…' : 'Confirm'}
            </button>
            <button
              onClick={cancel}
              className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg"
            >
              Cancel
            </button>
          </div>
          {mutation.isError && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
              Something went wrong. Please try again.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: TypeScript compile check**

```bash
cd f:/Development/home-lab/spends/frontend && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd f:/Development/home-lab/spends && git add frontend/src/api/dangerZone.ts frontend/src/pages/SettingsPage.tsx && git commit -m "feat: Danger Zone tab in Settings — 5 bulk-delete actions with typed confirmation"
```

---

## Post-implementation verification

After all tasks are committed, run the full backend test suite one final time:

```bash
cd f:/Development/home-lab/spends/backend && mvn test -q 2>&1 | tail -5
```

Expected: BUILD SUCCESS.
