# Phase 23: Productivity & Intelligence Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 10 productivity features: Transaction Notes, Import Confidence Score, Bulk Category Re-assignment, Net Worth Tracker, Budget Carry-Forward, Annual Budgets, Merchant Aliases, Split Transactions, Shared Expense Settlement, and Anomaly Notification Digest.

**Architecture:** All schema changes are purely additive (new tables/new nullable columns). Existing JPQL aggregation queries (categoryBreakdown, sumWithdrawals, sumDeposits) are NOT touched — this prevents regressions in dashboard, budgets, and reports. Each feature is a full vertical slice: migration → entity → service → controller → frontend component.

**Tech Stack:** Spring Boot 3.3.4 / Java 21 / JPA / Liquibase / Mockito TDD | React 18 / TypeScript / TanStack Query v5 / Tailwind CSS 3 / lucide-react / Recharts

---

### Task 1: Transaction Notes

**Files:**
- Create: `backend/src/main/resources/db/changelog/changes/011-transaction-note.yaml`
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/model/Transaction.java` (add `note` field)
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/TransactionDto.java` (add `note` to Response, add NoteRequest record)
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/TransactionService.java` (add `updateNote`)
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/TransactionController.java` (add PATCH /{id}/note)
- Modify: `backend/src/test/java/com/omprakashgautam/homelab/spends/service/TransactionServiceTest.java` (add updateNote tests)
- Modify: `frontend/src/api/transactions.ts` (add `note` to Transaction, add `updateNote`)
- Modify: `frontend/src/pages/TransactionPage.tsx` (inline note editor per row)

- [ ] **Step 1: Write the migration**

Create `backend/src/main/resources/db/changelog/changes/011-transaction-note.yaml`:
```yaml
databaseChangeLog:
  - changeSet:
      id: 011-transaction-note
      author: system
      changes:
        - addColumn:
            tableName: transaction
            columns:
              - column:
                  name: note
                  type: TEXT
                  constraints:
                    nullable: true
```

Add to `backend/src/main/resources/db/changelog/db.changelog-master.yaml` under the existing includes:
```yaml
  - include:
      file: changes/011-transaction-note.yaml
      relativeToChangelogFile: true
```

- [ ] **Step 2: Add note field to Transaction entity**

In `backend/src/main/java/com/omprakashgautam/homelab/spends/model/Transaction.java`, add after the `reviewed` field:
```java
@Column(columnDefinition = "TEXT")
private String note;
```

- [ ] **Step 3: Write failing service test**

In `TransactionServiceTest.java`, add:
```java
@Test
void updateNote_setsNoteAndReturns() {
    Transaction tx = Transaction.builder()
        .id(UUID.randomUUID())
        .rawRemarks("test")
        .withdrawalAmount(BigDecimal.ZERO)
        .depositAmount(BigDecimal.ZERO)
        .reviewed(false)
        .build();
    when(transactionRepository.findById(tx.getId())).thenReturn(Optional.of(tx));
    when(transactionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

    TransactionDto.Response result = transactionService.updateNote(tx.getId(), "my note");

    assertThat(result.note()).isEqualTo("my note");
    assertThat(tx.getNote()).isEqualTo("my note");
}
```

Run: `mvn test -pl backend -Dtest=TransactionServiceTest#updateNote_setsNoteAndReturns -q`
Expected: FAIL (method not found)

- [ ] **Step 4: Update TransactionDto**

In `TransactionDto.java`, add `note` to the Response record (after `reviewed`):
```java
String note,
```

Update the `from` factory method to include:
```java
.note(t.getNote())
```

Add a new record at the bottom of TransactionDto:
```java
public record NoteRequest(@NotBlank String note) {}
```

- [ ] **Step 5: Add updateNote to TransactionService**

```java
@Transactional
public TransactionDto.Response updateNote(UUID id, String note) {
    Transaction tx = transactionRepository.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    tx.setNote(note);
    return TransactionDto.Response.from(transactionRepository.save(tx));
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `mvn test -pl backend -Dtest=TransactionServiceTest#updateNote_setsNoteAndReturns -q`
Expected: PASS

- [ ] **Step 7: Add controller endpoint**

In `TransactionController.java`, add:
```java
@PatchMapping("/{id}/note")
public TransactionDto.Response updateNote(@PathVariable UUID id,
        @RequestBody @Valid TransactionDto.NoteRequest req) {
    return transactionService.updateNote(id, req.note());
}
```

- [ ] **Step 8: Update frontend API**

In `frontend/src/api/transactions.ts`:

Add `note: string | null` to the `Transaction` interface after `reviewed`.

Add the function:
```typescript
export async function updateNote(id: string, note: string): Promise<Transaction> {
  const { data } = await apiClient.patch<Transaction>(`/transactions/${id}/note`, { note })
  return data
}
```

- [ ] **Step 9: Add inline note editor to TransactionPage**

In `TransactionPage.tsx`, import `updateNote` from the API and `useMutation` from TanStack Query.

For each transaction row, add a note icon button (MessageSquare from lucide-react) that toggles a small inline textarea. On blur or Enter, call `updateNote`. Show existing note text truncated in the row if note is non-null.

The note cell should sit between the reviewed toggle and the category selector:
```tsx
// Per-row note state (use a Map<string, string> in component state or per-row component)
const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
const [noteText, setNoteText] = useState('')

const noteMutation = useMutation({
  mutationFn: ({ id, note }: { id: string; note: string }) => updateNote(id, note),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
})

// In the row:
<td className="px-3 py-2">
  {editingNoteId === tx.id ? (
    <input
      autoFocus
      className="w-32 text-xs border rounded px-1 py-0.5 dark:bg-gray-700 dark:border-gray-600"
      value={noteText}
      onChange={e => setNoteText(e.target.value)}
      onBlur={() => {
        noteMutation.mutate({ id: tx.id, note: noteText })
        setEditingNoteId(null)
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          noteMutation.mutate({ id: tx.id, note: noteText })
          setEditingNoteId(null)
        }
        if (e.key === 'Escape') setEditingNoteId(null)
      }}
    />
  ) : (
    <button
      onClick={() => { setEditingNoteId(tx.id); setNoteText(tx.note ?? '') }}
      className="text-xs text-gray-400 hover:text-blue-500 truncate max-w-[6rem] block"
      title={tx.note ?? 'Add note'}
    >
      {tx.note ? tx.note : <MessageSquare size={14} />}
    </button>
  )}
</td>
```

- [ ] **Step 10: Run backend tests**

Run: `mvn test -pl backend -q`
Expected: BUILD SUCCESS

- [ ] **Step 11: Commit**

```bash
git add backend/src/main/resources/db/changelog/changes/011-transaction-note.yaml \
        backend/src/main/resources/db/changelog/db.changelog-master.yaml \
        backend/src/main/java/com/omprakashgautam/homelab/spends/model/Transaction.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/dto/TransactionDto.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/service/TransactionService.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/controller/TransactionController.java \
        backend/src/test/java/com/omprakashgautam/homelab/spends/service/TransactionServiceTest.java \
        frontend/src/api/transactions.ts \
        frontend/src/pages/TransactionPage.tsx
git commit -m "feat: transaction notes — inline note editor per transaction"
git push origin main
```

---

### Task 2: Import Confidence Score

**Files:**
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/ImportResultDto.java` (add categorized, misc, categorizationPct)
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/ImportService.java` (count categorized vs misc)
- Modify: `frontend/src/api/import.ts` (add fields to FileSummary)
- Modify: `frontend/src/pages/ImportPage.tsx` (show confidence badge)

- [ ] **Step 1: Write failing test**

In `ImportServiceTest.java` (create if it doesn't exist at `backend/src/test/java/com/omprakashgautam/homelab/spends/service/ImportServiceTest.java`):
```java
@Test
void importFile_countsCategorizationStats() {
    // Given: parser returns 3 transactions, 2 have category rules, 1 does not
    // Stub parser, categoryRuleRepository, transactionRepository
    // When: importSingleFile() is called
    // Then: FileSummary.categorized == 2, misc == 1, categorizationPct == 67
}
```

Run: `mvn test -pl backend -Dtest=ImportServiceTest -q`
Expected: FAIL (fields missing)

- [ ] **Step 2: Update ImportResultDto**

In `ImportResultDto.java`, add to the `FileSummary` record:
```java
int categorized,
int misc,
int categorizationPct
```

- [ ] **Step 3: Update ImportService to track categorization**

In `ImportService.importSingleFile()`, after saving each transaction, track whether it got a category from the rule engine. Build a counter:
```java
int categorized = 0;
// ... in the transaction processing loop:
if (tx.getCategory() != null) categorized++;
// ...
int misc = imported - categorized;
int pct = imported > 0 ? (categorized * 100 / imported) : 0;
```

Return updated `FileSummary` with these three new fields.

- [ ] **Step 4: Run test to verify it passes**

Run: `mvn test -pl backend -Dtest=ImportServiceTest -q`
Expected: PASS

- [ ] **Step 5: Update frontend API**

In `frontend/src/api/import.ts`, add to the `FileSummary` interface:
```typescript
categorized: number
misc: number
categorizationPct: number
```

- [ ] **Step 6: Update ImportPage to show confidence badge**

In `ImportPage.tsx`, after showing imported/duplicate counts, add:
```tsx
<span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
  summary.categorizationPct >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
  summary.categorizationPct >= 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
  'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
}`}>
  {summary.categorizationPct}% categorized
</span>
```

- [ ] **Step 7: Run backend tests**

Run: `mvn test -pl backend -q`
Expected: BUILD SUCCESS

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/dto/ImportResultDto.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/service/ImportService.java \
        backend/src/test/java/com/omprakashgautam/homelab/spends/service/ImportServiceTest.java \
        frontend/src/api/import.ts \
        frontend/src/pages/ImportPage.tsx
git commit -m "feat: import confidence score — categorization percentage badge on import results"
git push origin main
```

---

### Task 3: Bulk Category Re-assignment (Backend)

**Files:**
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/TransactionDto.java` (add BulkCategoryRequest)
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/TransactionService.java` (add bulkUpdateCategory)
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/TransactionController.java` (add PATCH /bulk-category)
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionRepository.java` (add findAllByIdInAndUser)
- Modify: `backend/src/test/java/com/omprakashgautam/homelab/spends/service/TransactionServiceTest.java` (add bulk tests)

- [ ] **Step 1: Write failing test**

In `TransactionServiceTest.java`:
```java
@Test
void bulkUpdateCategory_updatesAllAndReturnsCount() {
    UUID catId = UUID.randomUUID();
    Category cat = Category.builder().id(catId).name("Food").build();
    List<UUID> txIds = List.of(UUID.randomUUID(), UUID.randomUUID());
    List<Transaction> txs = txIds.stream()
        .map(id -> Transaction.builder().id(id).rawRemarks("r")
            .withdrawalAmount(BigDecimal.ZERO).depositAmount(BigDecimal.ZERO)
            .reviewed(false).build())
        .collect(Collectors.toList());

    User user = User.builder().id(UUID.randomUUID()).build();
    when(userService.getCurrentUser()).thenReturn(user);
    when(transactionRepository.findAllByIdInAndUser(txIds, user)).thenReturn(txs);
    when(categoryRepository.findById(catId)).thenReturn(Optional.of(cat));
    when(transactionRepository.saveAll(any())).thenAnswer(i -> i.getArgument(0));

    int count = transactionService.bulkUpdateCategory(txIds, catId);

    assertThat(count).isEqualTo(2);
    txs.forEach(tx -> assertThat(tx.getCategory()).isEqualTo(cat));
}
```

Run: `mvn test -pl backend -Dtest=TransactionServiceTest#bulkUpdateCategory_updatesAllAndReturnsCount -q`
Expected: FAIL

- [ ] **Step 2: Add BulkCategoryRequest to TransactionDto**

```java
public record BulkCategoryRequest(
    @NotEmpty List<UUID> ids,
    @NotNull UUID categoryId
) {}
```

- [ ] **Step 3: Add repository method**

In `TransactionRepository.java`:
```java
List<Transaction> findAllByIdInAndUser(List<UUID> ids, User user);
```

- [ ] **Step 4: Implement bulkUpdateCategory in TransactionService**

```java
@Transactional
public int bulkUpdateCategory(List<UUID> ids, UUID categoryId) {
    User user = userService.getCurrentUser();
    Category category = categoryRepository.findById(categoryId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    List<Transaction> txs = transactionRepository.findAllByIdInAndUser(ids, user);
    txs.forEach(tx -> tx.setCategory(category));
    transactionRepository.saveAll(txs);
    return txs.size();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `mvn test -pl backend -Dtest=TransactionServiceTest#bulkUpdateCategory_updatesAllAndReturnsCount -q`
Expected: PASS

- [ ] **Step 6: Add controller endpoint**

```java
@PatchMapping("/bulk-category")
public Map<String, Integer> bulkUpdateCategory(
        @RequestBody @Valid TransactionDto.BulkCategoryRequest req) {
    int updated = transactionService.bulkUpdateCategory(req.ids(), req.categoryId());
    return Map.of("updated", updated);
}
```

- [ ] **Step 7: Run all backend tests**

Run: `mvn test -pl backend -q`
Expected: BUILD SUCCESS

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/dto/TransactionDto.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/service/TransactionService.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/controller/TransactionController.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionRepository.java \
        backend/src/test/java/com/omprakashgautam/homelab/spends/service/TransactionServiceTest.java
git commit -m "feat: bulk category re-assignment backend — PATCH /api/transactions/bulk-category"
git push origin main
```

---

### Task 4: Bulk Category Re-assignment (Frontend)

**Files:**
- Modify: `frontend/src/api/transactions.ts` (add bulkUpdateCategory)
- Modify: `frontend/src/pages/TransactionPage.tsx` (checkboxes, floating action bar)

- [ ] **Step 1: Add API function**

In `frontend/src/api/transactions.ts`:
```typescript
export async function bulkUpdateCategory(ids: string[], categoryId: string): Promise<{ updated: number }> {
  const { data } = await apiClient.patch<{ updated: number }>('/transactions/bulk-category', { ids, categoryId })
  return data
}
```

- [ ] **Step 2: Add checkbox column and selection state to TransactionPage**

At the top of the page component, add:
```tsx
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
const [bulkCategoryId, setBulkCategoryId] = useState('')

const toggleSelect = (id: string) => setSelectedIds(prev => {
  const next = new Set(prev)
  next.has(id) ? next.delete(id) : next.add(id)
  return next
})

const toggleAll = () => {
  if (selectedIds.size === data?.content.length) {
    setSelectedIds(new Set())
  } else {
    setSelectedIds(new Set(data?.content.map(tx => tx.id) ?? []))
  }
}
```

- [ ] **Step 3: Add checkbox header and row checkboxes**

In the table header, add a first `<th>` with:
```tsx
<th className="px-3 py-2">
  <input type="checkbox"
    checked={selectedIds.size === data?.content.length && data.content.length > 0}
    onChange={toggleAll}
  />
</th>
```

In each row, add a first `<td>` with:
```tsx
<td className="px-3 py-2">
  <input type="checkbox"
    checked={selectedIds.has(tx.id)}
    onChange={() => toggleSelect(tx.id)}
  />
</td>
```

- [ ] **Step 4: Add floating action bar**

Below the table (but inside the page container), add:
```tsx
{selectedIds.size > 0 && (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 shadow-xl rounded-xl px-6 py-3 flex items-center gap-4 border border-gray-200 dark:border-gray-700 z-50">
    <span className="text-sm font-medium">{selectedIds.size} selected</span>
    <select
      value={bulkCategoryId}
      onChange={e => setBulkCategoryId(e.target.value)}
      className="text-sm border rounded px-2 py-1 dark:bg-gray-700 dark:border-gray-600"
    >
      <option value="">Select category...</option>
      {categories?.map(cat => (
        <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
      ))}
    </select>
    <button
      disabled={!bulkCategoryId || bulkMutation.isPending}
      onClick={() => bulkMutation.mutate({ ids: Array.from(selectedIds), categoryId: bulkCategoryId })}
      className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded disabled:opacity-50"
    >
      Apply
    </button>
    <button onClick={() => setSelectedIds(new Set())} className="text-sm text-gray-500 hover:text-gray-700">
      Cancel
    </button>
  </div>
)}
```

- [ ] **Step 5: Add bulkMutation**

```tsx
const bulkMutation = useMutation({
  mutationFn: ({ ids, categoryId }: { ids: string[]; categoryId: string }) =>
    bulkUpdateCategory(ids, categoryId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    setSelectedIds(new Set())
    setBulkCategoryId('')
  },
})
```

Import `bulkUpdateCategory` from `../api/transactions`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/transactions.ts \
        frontend/src/pages/TransactionPage.tsx
git commit -m "feat: bulk category re-assignment UI — checkboxes and floating action bar"
git push origin main
```

---

### Task 5: Net Worth Tracker (Backend)

**Files:**
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/NetWorthDto.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/NetWorthService.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/NetWorthController.java`
- Create: `backend/src/test/java/com/omprakashgautam/homelab/spends/service/NetWorthServiceTest.java`
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionRepository.java` (add monthly flow query)

- [ ] **Step 1: Add monthly flow query to TransactionRepository**

```java
@Query("""
    SELECT YEAR(t.valueDate) as yr, MONTH(t.valueDate) as mo,
           SUM(t.depositAmount) as totalIn, SUM(t.withdrawalAmount) as totalOut
    FROM Transaction t
    WHERE t.bankAccount.user = :user
      AND t.valueDate >= :from
    GROUP BY YEAR(t.valueDate), MONTH(t.valueDate)
    ORDER BY yr, mo
    """)
List<Object[]> monthlyFlow(@Param("user") User user, @Param("from") LocalDate from);
```

- [ ] **Step 2: Create NetWorthDto**

```java
package com.omprakashgautam.homelab.spends.dto;

import java.math.BigDecimal;
import java.util.List;

public class NetWorthDto {
    public record MonthPoint(int year, int month, BigDecimal netFlow, BigDecimal cumulativeNet) {}
    public record Response(List<MonthPoint> points) {}
}
```

- [ ] **Step 3: Write failing test**

Create `NetWorthServiceTest.java`:
```java
@Test
void getNetWorth_returnsCumulativePoints() {
    User user = User.builder().id(UUID.randomUUID()).build();
    when(userService.getCurrentUser()).thenReturn(user);
    // Row: year=2024, month=1, in=1000, out=600
    Object[] row = { 2024, 1, new BigDecimal("1000"), new BigDecimal("600") };
    when(transactionRepository.monthlyFlow(eq(user), any())).thenReturn(List.of(row));

    NetWorthDto.Response result = netWorthService.getNetWorth(12);

    assertThat(result.points()).hasSize(1);
    assertThat(result.points().get(0).netFlow()).isEqualByComparingTo("400");
    assertThat(result.points().get(0).cumulativeNet()).isEqualByComparingTo("400");
}
```

Run: `mvn test -pl backend -Dtest=NetWorthServiceTest -q`
Expected: FAIL

- [ ] **Step 4: Implement NetWorthService**

```java
@Service
@RequiredArgsConstructor
public class NetWorthService {

    private final TransactionRepository transactionRepository;
    private final UserService userService;

    @Transactional(readOnly = true)
    public NetWorthDto.Response getNetWorth(int months) {
        User user = userService.getCurrentUser();
        LocalDate from = LocalDate.now().minusMonths(months).withDayOfMonth(1);
        List<Object[]> rows = transactionRepository.monthlyFlow(user, from);

        BigDecimal cumulative = BigDecimal.ZERO;
        List<NetWorthDto.MonthPoint> points = new ArrayList<>();
        for (Object[] row : rows) {
            int yr = ((Number) row[0]).intValue();
            int mo = ((Number) row[1]).intValue();
            BigDecimal totalIn = (BigDecimal) row[2];
            BigDecimal totalOut = (BigDecimal) row[3];
            BigDecimal net = totalIn.subtract(totalOut);
            cumulative = cumulative.add(net);
            points.add(new NetWorthDto.MonthPoint(yr, mo, net, cumulative));
        }
        return new NetWorthDto.Response(points);
    }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `mvn test -pl backend -Dtest=NetWorthServiceTest -q`
Expected: PASS

- [ ] **Step 6: Create NetWorthController**

```java
@RestController
@RequestMapping("/api/net-worth")
@RequiredArgsConstructor
public class NetWorthController {

    private final NetWorthService netWorthService;

    @GetMapping
    public NetWorthDto.Response getNetWorth(
            @RequestParam(defaultValue = "12") int months) {
        return netWorthService.getNetWorth(months);
    }
}
```

- [ ] **Step 7: Run all backend tests**

Run: `mvn test -pl backend -q`
Expected: BUILD SUCCESS

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/dto/NetWorthDto.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/service/NetWorthService.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/controller/NetWorthController.java \
        backend/src/test/java/com/omprakashgautam/homelab/spends/service/NetWorthServiceTest.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionRepository.java
git commit -m "feat: net worth tracker backend — monthly flow aggregation, GET /api/net-worth"
git push origin main
```

---

### Task 6: Net Worth Tracker (Frontend)

**Files:**
- Create: `frontend/src/api/netWorth.ts`
- Create: `frontend/src/pages/NetWorthPage.tsx`
- Modify: `frontend/src/App.tsx` (add route)
- Modify: `frontend/src/components/Layout.tsx` (add nav entry)

- [ ] **Step 1: Create API module**

Create `frontend/src/api/netWorth.ts`:
```typescript
import apiClient from './client'

export interface MonthPoint {
  year: number
  month: number
  netFlow: number
  cumulativeNet: number
}

export interface NetWorthResponse {
  points: MonthPoint[]
}

export async function getNetWorth(months = 12): Promise<NetWorthResponse> {
  const { data } = await apiClient.get<NetWorthResponse>('/net-worth', { params: { months } })
  return data
}
```

- [ ] **Step 2: Create NetWorthPage**

Create `frontend/src/pages/NetWorthPage.tsx`:
```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { getNetWorth } from '../api/netWorth'

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function NetWorthPage() {
  const [months, setMonths] = useState(12)
  const { data, isLoading } = useQuery({ queryKey: ['net-worth', months], queryFn: () => getNetWorth(months) })

  const chartData = data?.points.map(p => ({
    label: `${MONTH_LABELS[p.month - 1]} ${p.year}`,
    netFlow: p.netFlow,
    cumulativeNet: p.cumulativeNet,
  })) ?? []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Net Worth</h1>
        <select
          value={months}
          onChange={e => setMonths(Number(e.target.value))}
          className="text-sm border rounded px-3 py-1.5 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        >
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
          <option value={24}>Last 24 months</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-gray-400">Loading...</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Cumulative Net Cash Flow</h2>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="cumulativeNet" stroke="#6366f1" strokeWidth={2} dot={false} name="Cumulative" />
              <Line type="monotone" dataKey="netFlow" stroke="#10b981" strokeWidth={1.5} dot={false} name="Monthly Net" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add route**

In `frontend/src/App.tsx`, import `NetWorthPage` and add:
```tsx
<Route path="net-worth" element={<NetWorthPage />} />
```
(after the reports route)

- [ ] **Step 4: Add nav entry**

In `frontend/src/components/Layout.tsx`, add to the nav array (after Reports):
```tsx
{ to: '/net-worth', icon: TrendingUp, label: 'Net Worth' }
```
Import `TrendingUp` from lucide-react if not already imported.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/netWorth.ts \
        frontend/src/pages/NetWorthPage.tsx \
        frontend/src/App.tsx \
        frontend/src/components/Layout.tsx
git commit -m "feat: net worth tracker UI — line chart with monthly and cumulative net flow"
git push origin main
```

---

### Task 7: Budget Carry-Forward

**Files:**
- Create: `backend/src/main/resources/db/changelog/changes/012-budget-rollover.yaml`
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/model/Budget.java` (add rollover field)
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/BudgetDto.java` (expose rollover)
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/BudgetService.java` (effective limit logic)
- Modify: `backend/src/test/java/com/omprakashgautam/homelab/spends/service/BudgetServiceTest.java` (rollover tests)
- Modify: `frontend/src/pages/BudgetPage.tsx` (rollover toggle in set-budget modal)

- [ ] **Step 1: Write migration**

Create `backend/src/main/resources/db/changelog/changes/012-budget-rollover.yaml`:
```yaml
databaseChangeLog:
  - changeSet:
      id: 012-budget-rollover
      author: system
      changes:
        - addColumn:
            tableName: budget
            columns:
              - column:
                  name: rollover
                  type: boolean
                  defaultValueBoolean: false
                  constraints:
                    nullable: false
```

Add to `db.changelog-master.yaml`:
```yaml
  - include:
      file: changes/012-budget-rollover.yaml
      relativeToChangelogFile: true
```

- [ ] **Step 2: Add rollover to Budget entity**

In `Budget.java`, add:
```java
@Column(nullable = false)
private boolean rollover = false;
```

- [ ] **Step 3: Write failing test**

In `BudgetServiceTest.java`:
```java
@Test
void getMonthSummary_withRollover_addsUnspentFromPreviousMonth() {
    // Budget of 1000 with rollover=true
    // Previous month spent 600 → 400 carried over → effective limit = 1400
    // ...
}
```

Run: `mvn test -pl backend -Dtest=BudgetServiceTest#getMonthSummary_withRollover -q`
Expected: FAIL

- [ ] **Step 4: Update BudgetService effective limit logic**

In `BudgetService.getMonthSummary()`, for each budget with `rollover=true`:
1. Look up previous month's spend from the `transaction` table.
2. Calculate `unspent = budget.amount - previousMonthSpend` (min 0).
3. Use `effectiveLimit = budget.amount + unspent` in the summary response.

```java
BigDecimal effectiveLimit = budget.getAmount();
if (budget.isRollover()) {
    YearMonth prev = YearMonth.of(year, month).minusMonths(1);
    BigDecimal prevSpent = transactionRepository.sumWithdrawalsForCategoryAndMonth(
        user, budget.getCategory(), prev.getYear(), prev.getMonthValue());
    BigDecimal prevUnspent = budget.getAmount().subtract(prevSpent).max(BigDecimal.ZERO);
    effectiveLimit = effectiveLimit.add(prevUnspent);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `mvn test -pl backend -Dtest=BudgetServiceTest -q`
Expected: PASS

- [ ] **Step 6: Update BudgetDto and setBudget**

In `BudgetDto.java` (or wherever the SetBudgetRequest is), add `boolean rollover` to the request, and expose `rollover` in the response.

In `BudgetService.setBudget()`, set `budget.setRollover(req.rollover())`.

- [ ] **Step 7: Update BudgetPage frontend**

In the set-budget modal/form in `BudgetPage.tsx`, add a checkbox:
```tsx
<label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
  <input type="checkbox" checked={rollover} onChange={e => setRollover(e.target.checked)} />
  Carry forward unspent budget to next month
</label>
```

Pass `rollover` in the API call.

- [ ] **Step 8: Run all backend tests**

Run: `mvn test -pl backend -q`
Expected: BUILD SUCCESS

- [ ] **Step 9: Commit**

```bash
git add backend/src/main/resources/db/changelog/changes/012-budget-rollover.yaml \
        backend/src/main/resources/db/changelog/db.changelog-master.yaml \
        backend/src/main/java/com/omprakashgautam/homelab/spends/model/Budget.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/dto/BudgetDto.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/service/BudgetService.java \
        backend/src/test/java/com/omprakashgautam/homelab/spends/service/BudgetServiceTest.java \
        frontend/src/pages/BudgetPage.tsx
git commit -m "feat: budget carry-forward — rollover unspent budget to next month"
git push origin main
```

---

### Task 8: Annual Budgets (Backend)

**Files:**
- Create: `backend/src/main/resources/db/changelog/changes/013-annual-budget.yaml`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/model/AnnualBudget.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/AnnualBudgetRepository.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/AnnualBudgetDto.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/AnnualBudgetService.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/AnnualBudgetController.java`
- Create: `backend/src/test/java/com/omprakashgautam/homelab/spends/service/AnnualBudgetServiceTest.java`

- [ ] **Step 1: Write migration**

Create `013-annual-budget.yaml`:
```yaml
databaseChangeLog:
  - changeSet:
      id: 013-annual-budget
      author: system
      changes:
        - createTable:
            tableName: annual_budget
            columns:
              - column:
                  name: id
                  type: uuid
                  constraints:
                    primaryKey: true
                    nullable: false
              - column:
                  name: user_id
                  type: uuid
                  constraints:
                    nullable: false
                    foreignKeyName: fk_annual_budget_user
                    references: app_user(id)
              - column:
                  name: category_id
                  type: uuid
                  constraints:
                    nullable: false
                    foreignKeyName: fk_annual_budget_category
                    references: category(id)
              - column:
                  name: year
                  type: int
                  constraints:
                    nullable: false
              - column:
                  name: amount
                  type: decimal(15,2)
                  constraints:
                    nullable: false
              - column:
                  name: created_at
                  type: timestamp
                  constraints:
                    nullable: false
        - addUniqueConstraint:
            tableName: annual_budget
            columnNames: user_id, category_id, year
            constraintName: uq_annual_budget
```

Add to `db.changelog-master.yaml`:
```yaml
  - include:
      file: changes/013-annual-budget.yaml
      relativeToChangelogFile: true
```

- [ ] **Step 2: Create AnnualBudget entity**

```java
@Entity
@Table(name = "annual_budget",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id","category_id","year"}))
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class AnnualBudget {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Column(nullable = false) private int year;
    @Column(nullable = false, precision = 15, scale = 2) private BigDecimal amount;
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;

    @PrePersist protected void onCreate() { createdAt = LocalDateTime.now(); }
}
```

- [ ] **Step 3: Create AnnualBudgetRepository**

```java
public interface AnnualBudgetRepository extends JpaRepository<AnnualBudget, UUID> {
    List<AnnualBudget> findByUserAndYear(User user, int year);
    Optional<AnnualBudget> findByUserAndCategoryAndYear(User user, Category category, int year);
}
```

- [ ] **Step 4: Create AnnualBudgetDto**

```java
public class AnnualBudgetDto {
    public record Response(UUID id, UUID categoryId, String categoryName, String categoryIcon,
                           int year, BigDecimal amount, BigDecimal spent) {}
    public record SetRequest(@NotNull UUID categoryId, int year, @NotNull BigDecimal amount) {}
}
```

- [ ] **Step 5: Write failing test**

```java
@Test
void getAnnualSummary_returnsSpentVsBudget() {
    User user = ...;
    when(userService.getCurrentUser()).thenReturn(user);
    AnnualBudget ab = AnnualBudget.builder()... .year(2024).amount(new BigDecimal("12000")).build();
    when(annualBudgetRepository.findByUserAndYear(user, 2024)).thenReturn(List.of(ab));
    when(transactionRepository.sumWithdrawalsForCategoryAndYear(user, ab.getCategory(), 2024))
        .thenReturn(new BigDecimal("9000"));

    List<AnnualBudgetDto.Response> result = annualBudgetService.getAnnualSummary(2024);

    assertThat(result).hasSize(1);
    assertThat(result.get(0).spent()).isEqualByComparingTo("9000");
}
```

Run: `mvn test -pl backend -Dtest=AnnualBudgetServiceTest -q`
Expected: FAIL

- [ ] **Step 6: Add sumWithdrawalsForCategoryAndYear to TransactionRepository**

```java
@Query("SELECT COALESCE(SUM(t.withdrawalAmount), 0) FROM Transaction t " +
       "WHERE t.bankAccount.user = :user AND t.category = :category " +
       "AND YEAR(t.valueDate) = :year")
BigDecimal sumWithdrawalsForCategoryAndYear(@Param("user") User user,
    @Param("category") Category category, @Param("year") int year);
```

- [ ] **Step 7: Implement AnnualBudgetService**

```java
@Service @RequiredArgsConstructor
public class AnnualBudgetService {
    private final AnnualBudgetRepository annualBudgetRepository;
    private final CategoryRepository categoryRepository;
    private final TransactionRepository transactionRepository;
    private final UserService userService;

    @Transactional(readOnly = true)
    public List<AnnualBudgetDto.Response> getAnnualSummary(int year) {
        User user = userService.getCurrentUser();
        return annualBudgetRepository.findByUserAndYear(user, year).stream().map(ab -> {
            BigDecimal spent = transactionRepository.sumWithdrawalsForCategoryAndYear(
                user, ab.getCategory(), year);
            return new AnnualBudgetDto.Response(ab.getId(), ab.getCategory().getId(),
                ab.getCategory().getName(), ab.getCategory().getIcon(), year, ab.getAmount(), spent);
        }).toList();
    }

    @Transactional
    public AnnualBudgetDto.Response setAnnualBudget(AnnualBudgetDto.SetRequest req) {
        User user = userService.getCurrentUser();
        Category cat = categoryRepository.findById(req.categoryId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        AnnualBudget ab = annualBudgetRepository.findByUserAndCategoryAndYear(user, cat, req.year())
            .orElse(AnnualBudget.builder().user(user).category(cat).year(req.year()).build());
        ab.setAmount(req.amount());
        ab = annualBudgetRepository.save(ab);
        BigDecimal spent = transactionRepository.sumWithdrawalsForCategoryAndYear(user, cat, req.year());
        return new AnnualBudgetDto.Response(ab.getId(), cat.getId(), cat.getName(),
            cat.getIcon(), req.year(), ab.getAmount(), spent);
    }

    @Transactional
    public void deleteAnnualBudget(UUID id) {
        annualBudgetRepository.deleteById(id);
    }
}
```

- [ ] **Step 8: Run test**

Run: `mvn test -pl backend -Dtest=AnnualBudgetServiceTest -q`
Expected: PASS

- [ ] **Step 9: Create AnnualBudgetController**

```java
@RestController @RequestMapping("/api/annual-budgets") @RequiredArgsConstructor
public class AnnualBudgetController {
    private final AnnualBudgetService annualBudgetService;

    @GetMapping
    public List<AnnualBudgetDto.Response> getAnnualSummary(
            @RequestParam(defaultValue = "#{T(java.time.LocalDate).now().getYear()}") int year) {
        return annualBudgetService.getAnnualSummary(year);
    }

    @PutMapping
    public AnnualBudgetDto.Response setAnnualBudget(@RequestBody @Valid AnnualBudgetDto.SetRequest req) {
        return annualBudgetService.setAnnualBudget(req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAnnualBudget(@PathVariable UUID id) {
        annualBudgetService.deleteAnnualBudget(id);
    }
}
```

- [ ] **Step 10: Run all tests**

Run: `mvn test -pl backend -q`
Expected: BUILD SUCCESS

- [ ] **Step 11: Commit**

```bash
git add backend/src/main/resources/db/changelog/changes/013-annual-budget.yaml \
        backend/src/main/resources/db/changelog/db.changelog-master.yaml \
        backend/src/main/java/com/omprakashgautam/homelab/spends/model/AnnualBudget.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/repository/AnnualBudgetRepository.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/dto/AnnualBudgetDto.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/service/AnnualBudgetService.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/controller/AnnualBudgetController.java \
        backend/src/test/java/com/omprakashgautam/homelab/spends/service/AnnualBudgetServiceTest.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionRepository.java
git commit -m "feat: annual budgets backend — AnnualBudget entity, service, GET/PUT/DELETE /api/annual-budgets"
git push origin main
```

---

### Task 9: Annual Budgets (Frontend)

**Files:**
- Create: `frontend/src/api/annualBudgets.ts`
- Modify: `frontend/src/pages/BudgetPage.tsx` (Annual tab)

- [ ] **Step 1: Create API module**

```typescript
import apiClient from './client'

export interface AnnualBudgetResponse {
  id: string; categoryId: string; categoryName: string; categoryIcon: string
  year: number; amount: number; spent: number
}

export async function getAnnualBudgets(year: number): Promise<AnnualBudgetResponse[]> {
  const { data } = await apiClient.get<AnnualBudgetResponse[]>('/annual-budgets', { params: { year } })
  return data
}

export async function setAnnualBudget(categoryId: string, year: number, amount: number): Promise<AnnualBudgetResponse> {
  const { data } = await apiClient.put<AnnualBudgetResponse>('/annual-budgets', { categoryId, year, amount })
  return data
}

export async function deleteAnnualBudget(id: string): Promise<void> {
  await apiClient.delete(`/annual-budgets/${id}`)
}
```

- [ ] **Step 2: Add Annual tab to BudgetPage**

In `BudgetPage.tsx`, add a tab switcher at the top of the page:
```tsx
const [tab, setTab] = useState<'monthly' | 'annual'>('monthly')
const currentYear = new Date().getFullYear()

// Tab bar:
<div className="flex gap-2 mb-6">
  <button onClick={() => setTab('monthly')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'monthly' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>Monthly</button>
  <button onClick={() => setTab('annual')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'annual' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>Annual</button>
</div>
```

Show existing monthly content when `tab === 'monthly'`.

When `tab === 'annual'`:
```tsx
// Annual view:
const { data: annualData } = useQuery({ queryKey: ['annual-budgets', currentYear], queryFn: () => getAnnualBudgets(currentYear) })

<div className="space-y-3">
  {annualData?.map(ab => (
    <div key={ab.id} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex items-center gap-4">
      <span className="text-2xl">{ab.categoryIcon}</span>
      <div className="flex-1">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium dark:text-white">{ab.categoryName}</span>
          <span className="text-gray-500">₹{ab.spent.toLocaleString('en-IN')} / ₹{ab.amount.toLocaleString('en-IN')}</span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full">
          <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(100, (ab.spent/ab.amount)*100)}%` }} />
        </div>
      </div>
      <button onClick={() => deleteAnnualBudgetMutation.mutate(ab.id)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
    </div>
  ))}
  <button onClick={() => setShowAnnualForm(true)} className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 text-gray-400 hover:border-blue-400 text-sm">
    + Set Annual Budget
  </button>
</div>
```

Add `setAnnualBudget` and `deleteAnnualBudget` mutations. Import from `../api/annualBudgets`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/annualBudgets.ts \
        frontend/src/pages/BudgetPage.tsx
git commit -m "feat: annual budgets UI — Annual tab on Budget page with progress bars"
git push origin main
```

---

### Task 10: Merchant Aliases (Backend)

**Files:**
- Create: `backend/src/main/resources/db/changelog/changes/014-merchant-alias.yaml`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/model/MerchantAlias.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/MerchantAliasRepository.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/MerchantAliasDto.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/MerchantAliasService.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/MerchantAliasController.java`
- Create: `backend/src/test/java/com/omprakashgautam/homelab/spends/service/MerchantAliasServiceTest.java`
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/MerchantExtractor.java` (inject aliases)

- [ ] **Step 1: Write migration**

Create `014-merchant-alias.yaml`:
```yaml
databaseChangeLog:
  - changeSet:
      id: 014-merchant-alias
      author: system
      changes:
        - createTable:
            tableName: merchant_alias
            columns:
              - column: { name: id, type: uuid, constraints: { primaryKey: true, nullable: false } }
              - column: { name: user_id, type: uuid, constraints: { nullable: false, foreignKeyName: fk_merchant_alias_user, references: app_user(id) } }
              - column: { name: raw_pattern, type: varchar(500), constraints: { nullable: false } }
              - column: { name: display_name, type: varchar(200), constraints: { nullable: false } }
              - column: { name: created_at, type: timestamp, constraints: { nullable: false } }
        - addUniqueConstraint:
            tableName: merchant_alias
            columnNames: user_id, raw_pattern
            constraintName: uq_merchant_alias
```

Add to `db.changelog-master.yaml`.

- [ ] **Step 2: Create MerchantAlias entity**

```java
@Entity @Table(name = "merchant_alias",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id","raw_pattern"}))
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class MerchantAlias {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "user_id", nullable = false) private User user;
    @Column(name = "raw_pattern", nullable = false, length = 500) private String rawPattern;
    @Column(name = "display_name", nullable = false, length = 200) private String displayName;
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;
    @PrePersist protected void onCreate() { createdAt = LocalDateTime.now(); }
}
```

- [ ] **Step 3: Create MerchantAliasRepository**

```java
public interface MerchantAliasRepository extends JpaRepository<MerchantAlias, UUID> {
    List<MerchantAlias> findByUser(User user);
    Optional<MerchantAlias> findByUserAndRawPattern(User user, String rawPattern);
}
```

- [ ] **Step 4: Create MerchantAliasDto**

```java
public class MerchantAliasDto {
    public record Response(UUID id, String rawPattern, String displayName) {}
    public record SaveRequest(@NotBlank String rawPattern, @NotBlank String displayName) {}
}
```

- [ ] **Step 5: Write failing test**

```java
@Test
void save_createsAlias() {
    User user = User.builder().id(UUID.randomUUID()).build();
    when(userService.getCurrentUser()).thenReturn(user);
    when(merchantAliasRepository.findByUserAndRawPattern(user, "UPI/SWIGGY"))
        .thenReturn(Optional.empty());
    when(merchantAliasRepository.save(any())).thenAnswer(i -> {
        MerchantAlias a = i.getArgument(0);
        a.setId(UUID.randomUUID());
        return a;
    });

    MerchantAliasDto.Response result = merchantAliasService.save("UPI/SWIGGY", "Swiggy");

    assertThat(result.displayName()).isEqualTo("Swiggy");
    assertThat(result.rawPattern()).isEqualTo("UPI/SWIGGY");
}
```

Run: `mvn test -pl backend -Dtest=MerchantAliasServiceTest#save_createsAlias -q`
Expected: FAIL

- [ ] **Step 6: Implement MerchantAliasService**

```java
@Service @RequiredArgsConstructor
public class MerchantAliasService {
    private final MerchantAliasRepository merchantAliasRepository;
    private final UserService userService;

    @Transactional(readOnly = true)
    public List<MerchantAliasDto.Response> list() {
        User user = userService.getCurrentUser();
        return merchantAliasRepository.findByUser(user).stream()
            .map(a -> new MerchantAliasDto.Response(a.getId(), a.getRawPattern(), a.getDisplayName()))
            .toList();
    }

    @Transactional
    public MerchantAliasDto.Response save(String rawPattern, String displayName) {
        User user = userService.getCurrentUser();
        MerchantAlias alias = merchantAliasRepository.findByUserAndRawPattern(user, rawPattern)
            .orElse(MerchantAlias.builder().user(user).rawPattern(rawPattern).build());
        alias.setDisplayName(displayName);
        alias = merchantAliasRepository.save(alias);
        return new MerchantAliasDto.Response(alias.getId(), alias.getRawPattern(), alias.getDisplayName());
    }

    @Transactional
    public void delete(UUID id) { merchantAliasRepository.deleteById(id); }

    public Map<String, String> getAliasMap(User user) {
        return merchantAliasRepository.findByUser(user).stream()
            .collect(Collectors.toMap(MerchantAlias::getRawPattern, MerchantAlias::getDisplayName));
    }
}
```

- [ ] **Step 7: Run test**

Run: `mvn test -pl backend -Dtest=MerchantAliasServiceTest#save_createsAlias -q`
Expected: PASS

- [ ] **Step 8: Integrate aliases into MerchantExtractor**

In `MerchantExtractor.java`, inject `MerchantAliasRepository` (or `MerchantAliasService`). Add an `extract(String rawRemarks, User user)` overload that first checks alias map before applying heuristics:

```java
public String extract(String rawRemarks, User user) {
    Map<String, String> aliases = merchantAliasService.getAliasMap(user);
    for (Map.Entry<String, String> entry : aliases.entrySet()) {
        if (rawRemarks.contains(entry.getKey())) return entry.getValue();
    }
    return extract(rawRemarks); // fallback to heuristic
}
```

Keep the existing no-arg `extract(String)` intact for tests that don't pass a user.

- [ ] **Step 9: Create MerchantAliasController**

```java
@RestController @RequestMapping("/api/merchant-aliases") @RequiredArgsConstructor
public class MerchantAliasController {
    private final MerchantAliasService merchantAliasService;

    @GetMapping public List<MerchantAliasDto.Response> list() { return merchantAliasService.list(); }

    @PostMapping public MerchantAliasDto.Response save(@RequestBody @Valid MerchantAliasDto.SaveRequest req) {
        return merchantAliasService.save(req.rawPattern(), req.displayName());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) { merchantAliasService.delete(id); }
}
```

- [ ] **Step 10: Run all tests**

Run: `mvn test -pl backend -q`
Expected: BUILD SUCCESS

- [ ] **Step 11: Commit**

```bash
git add backend/src/main/resources/db/changelog/changes/014-merchant-alias.yaml \
        backend/src/main/resources/db/changelog/db.changelog-master.yaml \
        backend/src/main/java/com/omprakashgautam/homelab/spends/model/MerchantAlias.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/repository/MerchantAliasRepository.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/dto/MerchantAliasDto.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/service/MerchantAliasService.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/controller/MerchantAliasController.java \
        backend/src/test/java/com/omprakashgautam/homelab/spends/service/MerchantAliasServiceTest.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/service/MerchantExtractor.java
git commit -m "feat: merchant aliases backend — CRUD API + extractor integration"
git push origin main
```

---

### Task 11: Merchant Aliases (Frontend)

**Files:**
- Create: `frontend/src/api/merchantAliases.ts`
- Create: `frontend/src/pages/MerchantAliasesPage.tsx`
- Modify: `frontend/src/App.tsx` (add route)
- Modify: `frontend/src/components/Layout.tsx` (add nav entry under Settings)

- [ ] **Step 1: Create API module**

```typescript
import apiClient from './client'

export interface MerchantAlias { id: string; rawPattern: string; displayName: string }

export async function getMerchantAliases(): Promise<MerchantAlias[]> {
  const { data } = await apiClient.get<MerchantAlias[]>('/merchant-aliases')
  return data
}

export async function saveMerchantAlias(rawPattern: string, displayName: string): Promise<MerchantAlias> {
  const { data } = await apiClient.post<MerchantAlias>('/merchant-aliases', { rawPattern, displayName })
  return data
}

export async function deleteMerchantAlias(id: string): Promise<void> {
  await apiClient.delete(`/merchant-aliases/${id}`)
}
```

- [ ] **Step 2: Create MerchantAliasesPage**

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMerchantAliases, saveMerchantAlias, deleteMerchantAlias } from '../api/merchantAliases'
import { Trash2 } from 'lucide-react'

export default function MerchantAliasesPage() {
  const qc = useQueryClient()
  const [rawPattern, setRawPattern] = useState('')
  const [displayName, setDisplayName] = useState('')
  const { data = [] } = useQuery({ queryKey: ['merchant-aliases'], queryFn: getMerchantAliases })

  const saveMutation = useMutation({
    mutationFn: () => saveMerchantAlias(rawPattern, displayName),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['merchant-aliases'] }); setRawPattern(''); setDisplayName('') },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMerchantAlias(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merchant-aliases'] }),
  })

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Merchant Aliases</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">Map raw transaction remarks to friendly merchant names.</p>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Add Alias</h2>
        <div className="flex gap-2">
          <input placeholder="Raw pattern (e.g. UPI/SWIGGY)" value={rawPattern} onChange={e => setRawPattern(e.target.value)}
            className="flex-1 text-sm border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
          <input placeholder="Display name (e.g. Swiggy)" value={displayName} onChange={e => setDisplayName(e.target.value)}
            className="flex-1 text-sm border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
          <button onClick={() => saveMutation.mutate()} disabled={!rawPattern || !displayName || saveMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 rounded disabled:opacity-50">
            Save
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow divide-y divide-gray-100 dark:divide-gray-700">
        {data.length === 0 && <p className="p-4 text-sm text-gray-400">No aliases yet.</p>}
        {data.map(alias => (
          <div key={alias.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium dark:text-white">{alias.displayName}</p>
              <p className="text-xs text-gray-400 font-mono">{alias.rawPattern}</p>
            </div>
            <button onClick={() => deleteMutation.mutate(alias.id)} className="text-red-400 hover:text-red-600">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add route and nav**

In `App.tsx`:
```tsx
import MerchantAliasesPage from './pages/MerchantAliasesPage'
// Add route:
<Route path="merchant-aliases" element={<MerchantAliasesPage />} />
```

In `Layout.tsx`, add to nav after Settings:
```tsx
{ to: '/merchant-aliases', icon: Tag, label: 'Merchant Aliases' }
```
Import `Tag` from lucide-react.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/merchantAliases.ts \
        frontend/src/pages/MerchantAliasesPage.tsx \
        frontend/src/App.tsx \
        frontend/src/components/Layout.tsx
git commit -m "feat: merchant aliases UI — CRUD page for raw pattern to display name mapping"
git push origin main
```

---

### Task 12: Split Transactions (Backend)

**Files:**
- Create: `backend/src/main/resources/db/changelog/changes/015-transaction-split.yaml`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/model/TransactionSplit.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionSplitRepository.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/TransactionSplitDto.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/TransactionSplitService.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/TransactionSplitController.java`
- Create: `backend/src/test/java/com/omprakashgautam/homelab/spends/service/TransactionSplitServiceTest.java`

- [ ] **Step 1: Write migration**

Create `015-transaction-split.yaml`:
```yaml
databaseChangeLog:
  - changeSet:
      id: 015-transaction-split
      author: system
      changes:
        - createTable:
            tableName: transaction_split
            columns:
              - column: { name: id, type: uuid, constraints: { primaryKey: true, nullable: false } }
              - column: { name: transaction_id, type: uuid, constraints: { nullable: false, foreignKeyName: fk_split_transaction, references: transaction(id) } }
              - column: { name: category_id, type: uuid, constraints: { nullable: true, foreignKeyName: fk_split_category, references: category(id) } }
              - column: { name: amount, type: decimal(15,2), constraints: { nullable: false } }
              - column: { name: note, type: varchar(500) }
              - column: { name: created_at, type: timestamp, constraints: { nullable: false } }
```

Add to master changelog.

- [ ] **Step 2: Create TransactionSplit entity**

```java
@Entity @Table(name = "transaction_split")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class TransactionSplit {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transaction_id", nullable = false)
    private Transaction transaction;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(nullable = false, precision = 15, scale = 2) private BigDecimal amount;
    @Column(length = 500) private String note;
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;

    @PrePersist protected void onCreate() { createdAt = LocalDateTime.now(); }
}
```

- [ ] **Step 3: Create TransactionSplitRepository**

```java
public interface TransactionSplitRepository extends JpaRepository<TransactionSplit, UUID> {
    List<TransactionSplit> findByTransaction(Transaction transaction);
    void deleteByTransaction(Transaction transaction);
}
```

- [ ] **Step 4: Create TransactionSplitDto**

```java
public class TransactionSplitDto {
    public record SplitItem(UUID categoryId, BigDecimal amount, String note) {}
    public record Response(UUID id, UUID categoryId, String categoryName, BigDecimal amount, String note) {}
    public record SaveRequest(@NotEmpty List<SplitItem> splits) {}
}
```

- [ ] **Step 5: Write failing test**

```java
@Test
void saveSplits_replacesExistingAndReturns() {
    Transaction tx = Transaction.builder().id(UUID.randomUUID())
        .withdrawalAmount(new BigDecimal("1000")).depositAmount(BigDecimal.ZERO).build();
    when(transactionRepository.findById(tx.getId())).thenReturn(Optional.of(tx));
    Category cat = Category.builder().id(UUID.randomUUID()).name("Food").build();
    when(categoryRepository.findById(cat.getId())).thenReturn(Optional.of(cat));
    doNothing().when(transactionSplitRepository).deleteByTransaction(tx);
    when(transactionSplitRepository.saveAll(any())).thenAnswer(i -> i.getArgument(0));

    List<TransactionSplitDto.SplitItem> items = List.of(
        new TransactionSplitDto.SplitItem(cat.getId(), new BigDecimal("600"), "Groceries"),
        new TransactionSplitDto.SplitItem(null, new BigDecimal("400"), "Other")
    );
    List<TransactionSplitDto.Response> result = splitService.saveSplits(tx.getId(), items);

    assertThat(result).hasSize(2);
    assertThat(result.get(0).amount()).isEqualByComparingTo("600");
}
```

Run: `mvn test -pl backend -Dtest=TransactionSplitServiceTest -q`
Expected: FAIL

- [ ] **Step 6: Implement TransactionSplitService**

```java
@Service @RequiredArgsConstructor
public class TransactionSplitService {
    private final TransactionSplitRepository transactionSplitRepository;
    private final TransactionRepository transactionRepository;
    private final CategoryRepository categoryRepository;

    @Transactional(readOnly = true)
    public List<TransactionSplitDto.Response> getSplits(UUID txId) {
        Transaction tx = transactionRepository.findById(txId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return transactionSplitRepository.findByTransaction(tx).stream()
            .map(s -> new TransactionSplitDto.Response(s.getId(),
                s.getCategory() != null ? s.getCategory().getId() : null,
                s.getCategory() != null ? s.getCategory().getName() : null,
                s.getAmount(), s.getNote()))
            .toList();
    }

    @Transactional
    public List<TransactionSplitDto.Response> saveSplits(UUID txId, List<TransactionSplitDto.SplitItem> items) {
        Transaction tx = transactionRepository.findById(txId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        transactionSplitRepository.deleteByTransaction(tx);
        List<TransactionSplit> splits = items.stream().map(item -> {
            Category cat = item.categoryId() != null ?
                categoryRepository.findById(item.categoryId()).orElse(null) : null;
            return TransactionSplit.builder().transaction(tx).category(cat)
                .amount(item.amount()).note(item.note()).build();
        }).toList();
        List<TransactionSplit> saved = transactionSplitRepository.saveAll(splits);
        return saved.stream().map(s -> new TransactionSplitDto.Response(s.getId(),
            s.getCategory() != null ? s.getCategory().getId() : null,
            s.getCategory() != null ? s.getCategory().getName() : null,
            s.getAmount(), s.getNote())).toList();
    }
}
```

- [ ] **Step 7: Run test**

Run: `mvn test -pl backend -Dtest=TransactionSplitServiceTest -q`
Expected: PASS

- [ ] **Step 8: Create controller**

```java
@RestController @RequestMapping("/api/transactions/{id}/splits") @RequiredArgsConstructor
public class TransactionSplitController {
    private final TransactionSplitService transactionSplitService;

    @GetMapping
    public List<TransactionSplitDto.Response> getSplits(@PathVariable UUID id) {
        return transactionSplitService.getSplits(id);
    }

    @PutMapping
    public List<TransactionSplitDto.Response> saveSplits(@PathVariable UUID id,
            @RequestBody @Valid TransactionSplitDto.SaveRequest req) {
        return transactionSplitService.saveSplits(id, req.splits());
    }
}
```

- [ ] **Step 9: Run all tests**

Run: `mvn test -pl backend -q`
Expected: BUILD SUCCESS

- [ ] **Step 10: Commit**

```bash
git add backend/src/main/resources/db/changelog/changes/015-transaction-split.yaml \
        backend/src/main/resources/db/changelog/db.changelog-master.yaml \
        backend/src/main/java/com/omprakashgautam/homelab/spends/model/TransactionSplit.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionSplitRepository.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/dto/TransactionSplitDto.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/service/TransactionSplitService.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/controller/TransactionSplitController.java \
        backend/src/test/java/com/omprakashgautam/homelab/spends/service/TransactionSplitServiceTest.java
git commit -m "feat: split transactions backend — GET/PUT /api/transactions/{id}/splits"
git push origin main
```

---

### Task 13: Split Transactions (Frontend)

**Files:**
- Create: `frontend/src/api/splits.ts`
- Modify: `frontend/src/pages/TransactionPage.tsx` (split icon, inline split editor modal)

- [ ] **Step 1: Create API module**

```typescript
import apiClient from './client'

export interface SplitItem { categoryId?: string; amount: number; note?: string }
export interface SplitResponse { id: string; categoryId?: string; categoryName?: string; amount: number; note?: string }

export async function getSplits(txId: string): Promise<SplitResponse[]> {
  const { data } = await apiClient.get<SplitResponse[]>(`/transactions/${txId}/splits`)
  return data
}

export async function saveSplits(txId: string, splits: SplitItem[]): Promise<SplitResponse[]> {
  const { data } = await apiClient.put<SplitResponse[]>(`/transactions/${txId}/splits`, { splits })
  return data
}
```

- [ ] **Step 2: Add split state to TransactionPage**

```tsx
const [splitTxId, setSplitTxId] = useState<string | null>(null)
```

- [ ] **Step 3: Add split icon to each row**

In the transaction row actions (next to the reviewed toggle), add:
```tsx
<button onClick={() => setSplitTxId(tx.id)} className="text-gray-400 hover:text-purple-500" title="Split">
  <Scissors size={14} />
</button>
```
Import `Scissors` from lucide-react.

- [ ] **Step 4: Add SplitModal component (inline in same file)**

```tsx
function SplitModal({ txId, onClose, categories }: { txId: string; onClose: () => void; categories: TxCategory[] }) {
  const qc = useQueryClient()
  const { data: splits = [] } = useQuery({ queryKey: ['splits', txId], queryFn: () => getSplits(txId) })
  const [rows, setRows] = useState<{ categoryId: string; amount: string; note: string }[]>([])

  useEffect(() => {
    if (splits.length > 0) {
      setRows(splits.map(s => ({ categoryId: s.categoryId ?? '', amount: String(s.amount), note: s.note ?? '' })))
    } else {
      setRows([{ categoryId: '', amount: '', note: '' }, { categoryId: '', amount: '', note: '' }])
    }
  }, [splits])

  const saveMutation = useMutation({
    mutationFn: () => saveSplits(txId, rows.map(r => ({
      categoryId: r.categoryId || undefined,
      amount: parseFloat(r.amount),
      note: r.note || undefined,
    }))),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['splits', txId] }); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4">
        <h2 className="text-lg font-semibold dark:text-white">Split Transaction</h2>
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2 items-center">
            <select value={row.categoryId} onChange={e => setRows(rows.map((r, j) => j === i ? {...r, categoryId: e.target.value} : r))}
              className="flex-1 text-sm border rounded px-2 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
              <option value="">Uncategorized</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
            <input type="number" placeholder="Amount" value={row.amount}
              onChange={e => setRows(rows.map((r, j) => j === i ? {...r, amount: e.target.value} : r))}
              className="w-24 text-sm border rounded px-2 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            <input placeholder="Note" value={row.note}
              onChange={e => setRows(rows.map((r, j) => j === i ? {...r, note: e.target.value} : r))}
              className="flex-1 text-sm border rounded px-2 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            {rows.length > 2 && <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-red-400"><X size={14} /></button>}
          </div>
        ))}
        <button onClick={() => setRows([...rows, {categoryId:'',amount:'',note:''}])} className="text-sm text-blue-500 hover:underline">+ Add row</button>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="text-sm text-gray-500">Cancel</button>
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-1.5 rounded disabled:opacity-50">
            Save Splits
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Render modal**

In the TransactionPage JSX, add after the table:
```tsx
{splitTxId && <SplitModal txId={splitTxId} onClose={() => setSplitTxId(null)} categories={categories ?? []} />}
```

Import `getSplits`, `saveSplits` from `../api/splits`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/splits.ts \
        frontend/src/pages/TransactionPage.tsx
git commit -m "feat: split transactions UI — scissors icon + modal split editor"
git push origin main
```

---

### Task 14: Shared Expense Settlement (Backend)

**Files:**
- Create: `backend/src/main/resources/db/changelog/changes/016-settlement.yaml`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/model/Settlement.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/model/SettlementItem.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/SettlementRepository.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/SettlementDto.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/SettlementService.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/SettlementController.java`
- Create: `backend/src/test/java/com/omprakashgautam/homelab/spends/service/SettlementServiceTest.java`

- [ ] **Step 1: Write migration**

Create `016-settlement.yaml`:
```yaml
databaseChangeLog:
  - changeSet:
      id: 016-settlement
      author: system
      changes:
        - createTable:
            tableName: settlement
            columns:
              - column: { name: id, type: uuid, constraints: { primaryKey: true, nullable: false } }
              - column: { name: user_id, type: uuid, constraints: { nullable: false, foreignKeyName: fk_settlement_user, references: app_user(id) } }
              - column: { name: participant_name, type: varchar(200), constraints: { nullable: false } }
              - column: { name: description, type: varchar(500) }
              - column: { name: status, type: varchar(20), constraints: { nullable: false } }
              - column: { name: created_at, type: timestamp, constraints: { nullable: false } }
              - column: { name: settled_at, type: timestamp }
        - createTable:
            tableName: settlement_item
            columns:
              - column: { name: id, type: uuid, constraints: { primaryKey: true, nullable: false } }
              - column: { name: settlement_id, type: uuid, constraints: { nullable: false, foreignKeyName: fk_sitem_settlement, references: settlement(id) } }
              - column: { name: transaction_id, type: uuid, constraints: { nullable: true, foreignKeyName: fk_sitem_transaction, references: transaction(id) } }
              - column: { name: description, type: varchar(500), constraints: { nullable: false } }
              - column: { name: total_amount, type: decimal(15,2), constraints: { nullable: false } }
              - column: { name: your_share, type: decimal(15,2), constraints: { nullable: false } }
              - column: { name: created_at, type: timestamp, constraints: { nullable: false } }
```

Add to master changelog.

- [ ] **Step 2: Create Settlement and SettlementItem entities**

Settlement:
```java
@Entity @Table(name = "settlement")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Settlement {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "user_id", nullable = false) private User user;
    @Column(name = "participant_name", nullable = false, length = 200) private String participantName;
    @Column(length = 500) private String description;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private SettlementStatus status;
    @OneToMany(mappedBy = "settlement", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SettlementItem> items = new ArrayList<>();
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;
    @Column(name = "settled_at") private LocalDateTime settledAt;
    @PrePersist protected void onCreate() { createdAt = LocalDateTime.now(); }
}
```

SettlementStatus enum: `OPEN, SETTLED`

SettlementItem:
```java
@Entity @Table(name = "settlement_item")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class SettlementItem {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "settlement_id", nullable = false) private Settlement settlement;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "transaction_id") private Transaction transaction;
    @Column(nullable = false, length = 500) private String description;
    @Column(name = "total_amount", nullable = false, precision = 15, scale = 2) private BigDecimal totalAmount;
    @Column(name = "your_share", nullable = false, precision = 15, scale = 2) private BigDecimal yourShare;
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;
    @PrePersist protected void onCreate() { createdAt = LocalDateTime.now(); }
}
```

- [ ] **Step 3: Create SettlementRepository**

```java
public interface SettlementRepository extends JpaRepository<Settlement, UUID> {
    List<Settlement> findByUserOrderByCreatedAtDesc(User user);
}
```

- [ ] **Step 4: Create SettlementDto**

```java
public class SettlementDto {
    public record ItemRequest(UUID transactionId, String description, BigDecimal totalAmount, BigDecimal yourShare) {}
    public record CreateRequest(String participantName, String description, List<ItemRequest> items) {}
    public record ItemResponse(UUID id, UUID transactionId, String description, BigDecimal totalAmount, BigDecimal yourShare) {}
    public record Response(UUID id, String participantName, String description, SettlementStatus status,
                           BigDecimal totalOwed, List<ItemResponse> items, LocalDateTime createdAt, LocalDateTime settledAt) {}
}
```

- [ ] **Step 5: Write failing test**

```java
@Test
void create_savesSettlementWithItems() {
    User user = User.builder().id(UUID.randomUUID()).build();
    when(userService.getCurrentUser()).thenReturn(user);
    when(settlementRepository.save(any())).thenAnswer(i -> {
        Settlement s = i.getArgument(0);
        s.setId(UUID.randomUUID());
        return s;
    });

    SettlementDto.CreateRequest req = new SettlementDto.CreateRequest("Alice", "Dinner",
        List.of(new SettlementDto.ItemRequest(null, "Pizza", new BigDecimal("800"), new BigDecimal("400"))));

    SettlementDto.Response result = settlementService.create(req);

    assertThat(result.participantName()).isEqualTo("Alice");
    assertThat(result.totalOwed()).isEqualByComparingTo("400");
    assertThat(result.status()).isEqualTo(SettlementStatus.OPEN);
}
```

Run: `mvn test -pl backend -Dtest=SettlementServiceTest#create_savesSettlementWithItems -q`
Expected: FAIL

- [ ] **Step 6: Implement SettlementService**

```java
@Service @RequiredArgsConstructor
public class SettlementService {
    private final SettlementRepository settlementRepository;
    private final TransactionRepository transactionRepository;
    private final UserService userService;

    @Transactional
    public SettlementDto.Response create(SettlementDto.CreateRequest req) {
        User user = userService.getCurrentUser();
        Settlement settlement = Settlement.builder()
            .user(user).participantName(req.participantName())
            .description(req.description()).status(SettlementStatus.OPEN).build();
        req.items().forEach(item -> {
            Transaction tx = item.transactionId() != null ?
                transactionRepository.findById(item.transactionId()).orElse(null) : null;
            settlement.getItems().add(SettlementItem.builder()
                .settlement(settlement).transaction(tx)
                .description(item.description())
                .totalAmount(item.totalAmount()).yourShare(item.yourShare()).build());
        });
        return toResponse(settlementRepository.save(settlement));
    }

    @Transactional(readOnly = true)
    public List<SettlementDto.Response> list() {
        User user = userService.getCurrentUser();
        return settlementRepository.findByUserOrderByCreatedAtDesc(user).stream().map(this::toResponse).toList();
    }

    @Transactional
    public SettlementDto.Response markSettled(UUID id) {
        Settlement s = settlementRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        s.setStatus(SettlementStatus.SETTLED);
        s.setSettledAt(LocalDateTime.now());
        return toResponse(settlementRepository.save(s));
    }

    @Transactional
    public void delete(UUID id) { settlementRepository.deleteById(id); }

    private SettlementDto.Response toResponse(Settlement s) {
        BigDecimal totalOwed = s.getItems().stream()
            .map(SettlementItem::getYourShare).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<SettlementDto.ItemResponse> items = s.getItems().stream()
            .map(i -> new SettlementDto.ItemResponse(i.getId(),
                i.getTransaction() != null ? i.getTransaction().getId() : null,
                i.getDescription(), i.getTotalAmount(), i.getYourShare())).toList();
        return new SettlementDto.Response(s.getId(), s.getParticipantName(), s.getDescription(),
            s.getStatus(), totalOwed, items, s.getCreatedAt(), s.getSettledAt());
    }
}
```

- [ ] **Step 7: Run test**

Run: `mvn test -pl backend -Dtest=SettlementServiceTest -q`
Expected: PASS

- [ ] **Step 8: Create SettlementController**

```java
@RestController @RequestMapping("/api/settlements") @RequiredArgsConstructor
public class SettlementController {
    private final SettlementService settlementService;

    @GetMapping public List<SettlementDto.Response> list() { return settlementService.list(); }

    @PostMapping public SettlementDto.Response create(@RequestBody @Valid SettlementDto.CreateRequest req) {
        return settlementService.create(req);
    }

    @PatchMapping("/{id}/settle")
    public SettlementDto.Response markSettled(@PathVariable UUID id) {
        return settlementService.markSettled(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) { settlementService.delete(id); }
}
```

- [ ] **Step 9: Run all tests**

Run: `mvn test -pl backend -q`
Expected: BUILD SUCCESS

- [ ] **Step 10: Commit**

```bash
git add backend/src/main/resources/db/changelog/changes/016-settlement.yaml \
        backend/src/main/resources/db/changelog/db.changelog-master.yaml \
        backend/src/main/java/com/omprakashgautam/homelab/spends/model/Settlement.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/model/SettlementItem.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/model/SettlementStatus.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/repository/SettlementRepository.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/dto/SettlementDto.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/service/SettlementService.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/controller/SettlementController.java \
        backend/src/test/java/com/omprakashgautam/homelab/spends/service/SettlementServiceTest.java
git commit -m "feat: shared expense settlement backend — Settlement, SettlementItem, CRUD API"
git push origin main
```

---

### Task 15: Shared Expense Settlement (Frontend)

**Files:**
- Create: `frontend/src/api/settlements.ts`
- Create: `frontend/src/pages/SettlementsPage.tsx`
- Modify: `frontend/src/App.tsx` (add route)
- Modify: `frontend/src/components/Layout.tsx` (add nav entry)

- [ ] **Step 1: Create API module**

```typescript
import apiClient from './client'

export type SettlementStatus = 'OPEN' | 'SETTLED'

export interface SettlementItem { id: string; transactionId?: string; description: string; totalAmount: number; yourShare: number }
export interface Settlement { id: string; participantName: string; description?: string; status: SettlementStatus; totalOwed: number; items: SettlementItem[]; createdAt: string; settledAt?: string }
export interface CreateSettlementRequest { participantName: string; description?: string; items: { transactionId?: string; description: string; totalAmount: number; yourShare: number }[] }

export async function getSettlements(): Promise<Settlement[]> {
  const { data } = await apiClient.get<Settlement[]>('/settlements')
  return data
}

export async function createSettlement(req: CreateSettlementRequest): Promise<Settlement> {
  const { data } = await apiClient.post<Settlement>('/settlements', req)
  return data
}

export async function markSettled(id: string): Promise<Settlement> {
  const { data } = await apiClient.patch<Settlement>(`/settlements/${id}/settle`)
  return data
}

export async function deleteSettlement(id: string): Promise<void> {
  await apiClient.delete(`/settlements/${id}`)
}
```

- [ ] **Step 2: Create SettlementsPage**

Create `frontend/src/pages/SettlementsPage.tsx` with:
- Query for all settlements
- Two sections: Open (status=OPEN) and Settled (status=SETTLED)
- Each card shows: participant name, description, total owed, item list
- "Mark Settled" button on open cards
- "Delete" button on all cards
- "New Settlement" button opens a modal with participantName, description, and dynamically-added item rows (description, totalAmount, yourShare)

Key JSX structure:
```tsx
export default function SettlementsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const { data = [] } = useQuery({ queryKey: ['settlements'], queryFn: getSettlements })
  const openSettlements = data.filter(s => s.status === 'OPEN')
  const settledSettlements = data.filter(s => s.status === 'SETTLED')

  const markSettledMutation = useMutation({
    mutationFn: markSettled,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settlements'] }),
  })
  const deleteMutation = useMutation({
    mutationFn: deleteSettlement,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settlements'] }),
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-white">Settlements</h1>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg">New Settlement</button>
      </div>
      {/* Open section */}
      {/* Settled section */}
      {showForm && <CreateSettlementModal onClose={() => setShowForm(false)} onCreated={() => { qc.invalidateQueries({ queryKey: ['settlements'] }); setShowForm(false) }} />}
    </div>
  )
}
```

Render settlement cards with: participant name, total owed badge, list of items (description / amount / your share), Mark Settled and Delete buttons.

- [ ] **Step 3: Add route and nav**

In `App.tsx`:
```tsx
import SettlementsPage from './pages/SettlementsPage'
<Route path="settlements" element={<SettlementsPage />} />
```

In `Layout.tsx`:
```tsx
{ to: '/settlements', icon: Users, label: 'Settlements' }
```
Import `Users` from lucide-react.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/settlements.ts \
        frontend/src/pages/SettlementsPage.tsx \
        frontend/src/App.tsx \
        frontend/src/components/Layout.tsx
git commit -m "feat: shared expense settlement UI — SettlementsPage with open/settled sections"
git push origin main
```

---

### Task 16: Anomaly Notification Digest

**Files:**
- Create: `backend/src/main/resources/db/changelog/changes/017-notification-email.yaml`
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/model/User.java` (add notificationEmail)
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/UserDto.java` (expose notificationEmail)
- Modify: `backend/pom.xml` (add spring-boot-starter-mail dependency)
- Modify: `backend/src/main/resources/application.yml` (add mail config section)
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/NotificationService.java`
- Create: `backend/src/test/java/com/omprakashgautam/homelab/spends/service/NotificationServiceTest.java`
- Modify: `frontend/src/pages/SettingsPage.tsx` (add notification email field)
- Modify: `frontend/src/api/user.ts` (add notificationEmail to update)

- [ ] **Step 1: Write migration**

Create `017-notification-email.yaml`:
```yaml
databaseChangeLog:
  - changeSet:
      id: 017-notification-email
      author: system
      changes:
        - addColumn:
            tableName: app_user
            columns:
              - column:
                  name: notification_email
                  type: varchar(255)
                  constraints:
                    nullable: true
```

Add to master changelog.

- [ ] **Step 2: Add notificationEmail to User entity**

In `User.java`, add:
```java
@Column(name = "notification_email", length = 255)
private String notificationEmail;
```

- [ ] **Step 3: Add spring-boot-starter-mail to pom.xml**

In `backend/pom.xml`, inside `<dependencies>`:
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-mail</artifactId>
</dependency>
```

- [ ] **Step 4: Add mail config to application.yml**

In `backend/src/main/resources/application.yml`, add:
```yaml
spring:
  mail:
    host: ${MAIL_HOST:smtp.gmail.com}
    port: ${MAIL_PORT:587}
    username: ${MAIL_USERNAME:}
    password: ${MAIL_PASSWORD:}
    properties:
      mail:
        smtp:
          auth: true
          starttls:
            enable: true
notification:
  enabled: ${NOTIFICATION_ENABLED:false}
```

- [ ] **Step 5: Write failing test**

Create `NotificationServiceTest.java`:
```java
@Test
void buildDigest_detectsLargeWithdrawal() {
    User user = User.builder().id(UUID.randomUUID()).notificationEmail("test@test.com").build();
    when(userRepository.findAll()).thenReturn(List.of(user));

    Transaction bigTx = Transaction.builder()
        .withdrawalAmount(new BigDecimal("50000"))
        .depositAmount(BigDecimal.ZERO)
        .rawRemarks("Big spend")
        .valueDate(LocalDate.now().minusDays(1))
        .build();
    when(transactionRepository.findLargeWithdrawalsInLast24Hours(eq(user), any()))
        .thenReturn(List.of(bigTx));

    List<NotificationService.AnomalyEntry> anomalies = notificationService.detectAnomalies(user);

    assertThat(anomalies).hasSize(1);
    assertThat(anomalies.get(0).amount()).isEqualByComparingTo("50000");
}
```

Run: `mvn test -pl backend -Dtest=NotificationServiceTest -q`
Expected: FAIL

- [ ] **Step 6: Add large withdrawal query to TransactionRepository**

```java
@Query("SELECT t FROM Transaction t WHERE t.bankAccount.user = :user " +
       "AND t.withdrawalAmount > :threshold AND t.valueDate >= :since")
List<Transaction> findLargeWithdrawalsInLast24Hours(@Param("user") User user,
    @Param("since") LocalDate since, @Param("threshold") BigDecimal threshold);
```

Use threshold of `new BigDecimal("10000")` (configurable).

- [ ] **Step 7: Implement NotificationService**

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final JavaMailSender mailSender;

    @Value("${notification.enabled:false}")
    private boolean enabled;

    public record AnomalyEntry(String description, BigDecimal amount) {}

    public List<AnomalyEntry> detectAnomalies(User user) {
        LocalDate since = LocalDate.now().minusDays(1);
        BigDecimal threshold = new BigDecimal("10000");
        return transactionRepository.findLargeWithdrawalsInLast24Hours(user, since, threshold)
            .stream()
            .map(tx -> new AnomalyEntry(tx.getRawRemarks(), tx.getWithdrawalAmount()))
            .toList();
    }

    @Scheduled(cron = "0 0 8 * * *")
    public void sendDailyDigest() {
        if (!enabled) {
            log.debug("Notifications disabled, skipping digest");
            return;
        }
        userRepository.findAll().stream()
            .filter(u -> u.getNotificationEmail() != null && !u.getNotificationEmail().isBlank())
            .forEach(user -> {
                List<AnomalyEntry> anomalies = detectAnomalies(user);
                if (!anomalies.isEmpty()) sendDigestEmail(user, anomalies);
            });
    }

    private void sendDigestEmail(User user, List<AnomalyEntry> anomalies) {
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setTo(user.getNotificationEmail());
            msg.setSubject("SpendStack: " + anomalies.size() + " anomalies detected");
            StringBuilder body = new StringBuilder("Hi " + user.getDisplayName() + ",\n\nThe following large transactions were detected in the last 24 hours:\n\n");
            anomalies.forEach(a -> body.append("• ").append(a.description()).append(" — ₹").append(a.amount().toPlainString()).append("\n"));
            body.append("\nLog in to review: http://spends.local\n");
            msg.setText(body.toString());
            mailSender.send(msg);
        } catch (Exception e) {
            log.warn("Failed to send digest to {}: {}", user.getNotificationEmail(), e.getMessage());
        }
    }
}
```

Add `@EnableScheduling` to the main application class.

- [ ] **Step 8: Run test**

Run: `mvn test -pl backend -Dtest=NotificationServiceTest -q`
Expected: PASS

- [ ] **Step 9: Expose notificationEmail in UserDto and settings endpoint**

In `UserDto.java` (or wherever the profile response is defined), add `String notificationEmail`.

In `UserService.updateProfile()` (or equivalent), allow setting `notificationEmail`.

- [ ] **Step 10: Update SettingsPage**

In `frontend/src/pages/SettingsPage.tsx`, add a field for notification email:
```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notification Email</label>
  <input
    type="email"
    value={notificationEmail}
    onChange={e => setNotificationEmail(e.target.value)}
    placeholder="email@example.com — for anomaly alerts"
    className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
  />
  <p className="text-xs text-gray-400 mt-1">Daily digest of large transactions (&gt;₹10,000). Leave empty to disable.</p>
</div>
```

- [ ] **Step 11: Run all backend tests**

Run: `mvn test -pl backend -q`
Expected: BUILD SUCCESS

- [ ] **Step 12: Commit**

```bash
git add backend/src/main/resources/db/changelog/changes/017-notification-email.yaml \
        backend/src/main/resources/db/changelog/db.changelog-master.yaml \
        backend/src/main/java/com/omprakashgautam/homelab/spends/model/User.java \
        backend/pom.xml \
        backend/src/main/resources/application.yml \
        backend/src/main/java/com/omprakashgautam/homelab/spends/service/NotificationService.java \
        backend/src/test/java/com/omprakashgautam/homelab/spends/service/NotificationServiceTest.java \
        frontend/src/pages/SettingsPage.tsx
git commit -m "feat: anomaly notification digest — daily email for large transactions, opt-in via Settings"
git push origin main
```
