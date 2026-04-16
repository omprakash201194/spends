# Data Health / Audit Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/data-health` page that shows uncategorized transaction counts, rule coverage stats, and near-duplicate candidates so the user can spot and fix data quality problems.

**Architecture:** Single `GET /api/data-health` endpoint backed by 6 new repository queries and a new `DataHealthService`; the frontend page is a read-only status dashboard with stat cards, a categorization health bar, rule counts, and a conditional near-duplicate table.

**Tech Stack:** Spring Boot 3.3.4 / Java 21 / JPA JPQL · React 18 + TypeScript · TanStack Query v5 · Tailwind CSS 3 (dark mode class strategy) · lucide-react

---

## File Map

| Status | Path | Role |
|---|---|---|
| Create | `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/DataHealthDto.java` | 4 nested records: TransactionStats, RuleStats, NearDuplicate, Report |
| Modify | `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionRepository.java` | 6 new JPQL queries |
| Modify | `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/CategoryRuleRepository.java` | 2 new count queries |
| Create | `backend/src/main/java/com/omprakashgautam/homelab/spends/service/DataHealthService.java` | Orchestrates queries → builds Report |
| Create | `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/DataHealthController.java` | GET /api/data-health |
| Create | `backend/src/test/java/com/omprakashgautam/homelab/spends/service/DataHealthServiceTest.java` | 3 Mockito unit tests |
| Create | `frontend/src/api/dataHealth.ts` | Axios wrapper + TS interfaces |
| Create | `frontend/src/pages/DataHealthPage.tsx` | Status dashboard page |
| Modify | `frontend/src/App.tsx` | Add `/data-health` route |
| Modify | `frontend/src/components/Layout.tsx` | Add "Data Health" nav link |

---

## Task 1: Backend — DTO + Repository queries

**Files:**
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/DataHealthDto.java`
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionRepository.java`
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/CategoryRuleRepository.java`

- [ ] **Step 1: Create the DTO**

Create `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/DataHealthDto.java`:

```java
package com.omprakashgautam.homelab.spends.dto;

import java.math.BigDecimal;
import java.util.List;

public class DataHealthDto {

    /**
     * Counts and date-range stats for the user's transaction corpus.
     * earliestDate / latestDate are nullable ISO strings ("2024-01-05") — null when the user
     * has no transactions yet.
     */
    public record TransactionStats(
            long total,
            long uncategorized,
            long miscellaneous,
            String earliestDate,
            String latestDate,
            long accountCount
    ) {}

    public record RuleStats(
            long userRules,
            long globalRules
    ) {}

    /**
     * A group of transactions that share the same bank account, date, and withdrawal amount —
     * they may be accidental duplicates that slipped past the hash guard (e.g. slightly different
     * remarks strings).
     */
    public record NearDuplicate(
            String accountLabel,   // "XXXX1234 · ICICI"
            String date,           // ISO "2025-03-15"
            BigDecimal amount,
            long count
    ) {}

    public record Report(
            TransactionStats transactions,
            RuleStats rules,
            List<NearDuplicate> nearDuplicates
    ) {}
}
```

- [ ] **Step 2: Add 6 new queries to TransactionRepository**

Open `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionRepository.java`.

Append these methods at the bottom of the interface, after the `merchantMonthlyActivity` method:

```java
// ── Data health: aggregate counts ─────────────────────────────────────────

@Query("SELECT COUNT(t) FROM Transaction t WHERE t.bankAccount.user.id = :userId")
long countByUserId(@Param("userId") UUID userId);

@Query("SELECT COUNT(t) FROM Transaction t WHERE t.bankAccount.user.id = :userId AND t.category IS NULL")
long countUncategorized(@Param("userId") UUID userId);

@Query("""
    SELECT COUNT(t) FROM Transaction t
    WHERE t.bankAccount.user.id = :userId
      AND t.category.name = :categoryName
    """)
long countByCategoryName(@Param("userId") UUID userId,
                         @Param("categoryName") String categoryName);

@Query("SELECT MIN(t.valueDate) FROM Transaction t WHERE t.bankAccount.user.id = :userId")
LocalDate earliestDate(@Param("userId") UUID userId);

@Query("""
    SELECT COUNT(DISTINCT t.bankAccount.id) FROM Transaction t
    WHERE t.bankAccount.user.id = :userId
    """)
long countDistinctBankAccounts(@Param("userId") UUID userId);

// ── Data health: near-duplicate candidates ────────────────────────────────

/**
 * Groups withdrawals by (bank account, date, amount). If a group has more than one row,
 * the transactions may be accidental duplicates (same amount + date but different remarks).
 * Returns at most 10 groups, ordered by count desc then amount desc.
 *
 * Row layout: [accountNumberMasked (String), bankName (String), valueDate (LocalDate),
 *              withdrawalAmount (BigDecimal), count (Long)]
 */
@Query("""
    SELECT t.bankAccount.accountNumberMasked, t.bankAccount.bankName,
           t.valueDate, t.withdrawalAmount, COUNT(t)
    FROM Transaction t
    WHERE t.bankAccount.user.id = :userId
      AND t.withdrawalAmount > 0
    GROUP BY t.bankAccount.id, t.bankAccount.accountNumberMasked, t.bankAccount.bankName,
             t.valueDate, t.withdrawalAmount
    HAVING COUNT(t) > 1
    ORDER BY COUNT(t) DESC, t.withdrawalAmount DESC
    LIMIT 10
    """)
List<Object[]> findNearDuplicates(@Param("userId") UUID userId);
```

- [ ] **Step 3: Add 2 count queries to CategoryRuleRepository**

Open `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/CategoryRuleRepository.java`.

Append after `listRulesForUser`:

```java
@Query("SELECT COUNT(r) FROM CategoryRule r WHERE r.user.id = :userId")
long countByUserId(@Param("userId") UUID userId);

@Query("SELECT COUNT(r) FROM CategoryRule r WHERE r.global = TRUE")
long countGlobal();
```

Add the missing import at the top of the file:

```java
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
```

(It already has these — just verify they're present before adding.)

- [ ] **Step 4: Compile check**

```bash
cd backend && mvn compile -q
```

Expected: BUILD SUCCESS, no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/dto/DataHealthDto.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionRepository.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/repository/CategoryRuleRepository.java
git commit -m "feat: add DataHealthDto + repository queries for data health endpoint"
```

---

## Task 2: Backend — Service + tests

**Files:**
- Create: `backend/src/test/java/com/omprakashgautam/homelab/spends/service/DataHealthServiceTest.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/DataHealthService.java`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/test/java/com/omprakashgautam/homelab/spends/service/DataHealthServiceTest.java`:

```java
package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.DataHealthDto;
import com.omprakashgautam.homelab.spends.repository.CategoryRuleRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DataHealthServiceTest {

    @Mock TransactionRepository transactionRepository;
    @Mock CategoryRuleRepository categoryRuleRepository;

    @InjectMocks DataHealthService dataHealthService;

    private static final UUID USER_ID = UUID.randomUUID();

    private void stubDefaults() {
        when(transactionRepository.countByUserId(USER_ID)).thenReturn(100L);
        when(transactionRepository.countUncategorized(USER_ID)).thenReturn(5L);
        when(transactionRepository.countByCategoryName(USER_ID, "Miscellaneous")).thenReturn(20L);
        when(transactionRepository.earliestDate(USER_ID)).thenReturn(LocalDate.of(2024, 1, 1));
        when(transactionRepository.latestTransactionDate(USER_ID)).thenReturn(LocalDate.of(2025, 3, 31));
        when(transactionRepository.countDistinctBankAccounts(USER_ID)).thenReturn(2L);
        when(categoryRuleRepository.countByUserId(USER_ID)).thenReturn(8L);
        when(categoryRuleRepository.countGlobal()).thenReturn(52L);
        when(transactionRepository.findNearDuplicates(USER_ID)).thenReturn(List.of());
    }

    @Test
    void getReport_returnsCorrectStats() {
        stubDefaults();

        DataHealthDto.Report report = dataHealthService.getReport(USER_ID);

        assertThat(report.transactions().total()).isEqualTo(100L);
        assertThat(report.transactions().uncategorized()).isEqualTo(5L);
        assertThat(report.transactions().miscellaneous()).isEqualTo(20L);
        assertThat(report.transactions().earliestDate()).isEqualTo("2024-01-01");
        assertThat(report.transactions().latestDate()).isEqualTo("2025-03-31");
        assertThat(report.transactions().accountCount()).isEqualTo(2L);
        assertThat(report.rules().userRules()).isEqualTo(8L);
        assertThat(report.rules().globalRules()).isEqualTo(52L);
        assertThat(report.nearDuplicates()).isEmpty();
    }

    @Test
    void getReport_returnsNearDuplicatesWhenPresent() {
        stubDefaults();
        Object[] dupRow = new Object[]{
                "XXXX1234", "ICICI",
                LocalDate.of(2025, 3, 15),
                new BigDecimal("5000"),
                2L
        };
        when(transactionRepository.findNearDuplicates(USER_ID)).thenReturn(List.of(dupRow));

        DataHealthDto.Report report = dataHealthService.getReport(USER_ID);

        assertThat(report.nearDuplicates()).hasSize(1);
        DataHealthDto.NearDuplicate dup = report.nearDuplicates().get(0);
        assertThat(dup.accountLabel()).isEqualTo("XXXX1234 · ICICI");
        assertThat(dup.date()).isEqualTo("2025-03-15");
        assertThat(dup.amount()).isEqualByComparingTo("5000");
        assertThat(dup.count()).isEqualTo(2L);
    }

    @Test
    void getReport_handlesNoTransactions() {
        when(transactionRepository.countByUserId(USER_ID)).thenReturn(0L);
        when(transactionRepository.countUncategorized(USER_ID)).thenReturn(0L);
        when(transactionRepository.countByCategoryName(USER_ID, "Miscellaneous")).thenReturn(0L);
        when(transactionRepository.earliestDate(USER_ID)).thenReturn(null);
        when(transactionRepository.latestTransactionDate(USER_ID)).thenReturn(null);
        when(transactionRepository.countDistinctBankAccounts(USER_ID)).thenReturn(0L);
        when(categoryRuleRepository.countByUserId(USER_ID)).thenReturn(0L);
        when(categoryRuleRepository.countGlobal()).thenReturn(52L);
        when(transactionRepository.findNearDuplicates(USER_ID)).thenReturn(List.of());

        DataHealthDto.Report report = dataHealthService.getReport(USER_ID);

        assertThat(report.transactions().total()).isEqualTo(0L);
        assertThat(report.transactions().earliestDate()).isNull();
        assertThat(report.transactions().latestDate()).isNull();
        assertThat(report.nearDuplicates()).isEmpty();
    }
}
```

- [ ] **Step 2: Run tests — expect 3 failures**

```bash
cd backend && mvn test -pl . -Dtest=DataHealthServiceTest -q 2>&1 | tail -20
```

Expected: 3 failures — `DataHealthService` does not exist yet.

- [ ] **Step 3: Implement DataHealthService**

Create `backend/src/main/java/com/omprakashgautam/homelab/spends/service/DataHealthService.java`:

```java
package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.DataHealthDto;
import com.omprakashgautam.homelab.spends.repository.CategoryRuleRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DataHealthService {

    private final TransactionRepository transactionRepository;
    private final CategoryRuleRepository categoryRuleRepository;

    @Transactional(readOnly = true)
    public DataHealthDto.Report getReport(UUID userId) {
        long total        = transactionRepository.countByUserId(userId);
        long uncategorized = transactionRepository.countUncategorized(userId);
        long miscellaneous = transactionRepository.countByCategoryName(userId, "Miscellaneous");
        LocalDate earliest = transactionRepository.earliestDate(userId);
        LocalDate latest   = transactionRepository.latestTransactionDate(userId);
        long accounts      = transactionRepository.countDistinctBankAccounts(userId);

        long userRules   = categoryRuleRepository.countByUserId(userId);
        long globalRules = categoryRuleRepository.countGlobal();

        List<DataHealthDto.NearDuplicate> dups = transactionRepository.findNearDuplicates(userId)
                .stream()
                .map(r -> new DataHealthDto.NearDuplicate(
                        r[0] + " · " + r[1],
                        ((LocalDate) r[2]).toString(),
                        (BigDecimal) r[3],
                        (Long) r[4]
                ))
                .toList();

        return new DataHealthDto.Report(
                new DataHealthDto.TransactionStats(
                        total, uncategorized, miscellaneous,
                        earliest != null ? earliest.toString() : null,
                        latest   != null ? latest.toString()   : null,
                        accounts
                ),
                new DataHealthDto.RuleStats(userRules, globalRules),
                dups
        );
    }
}
```

- [ ] **Step 4: Run tests — expect 3 passes**

```bash
cd backend && mvn test -pl . -Dtest=DataHealthServiceTest -q 2>&1 | tail -10
```

Expected:
```
Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/service/DataHealthService.java \
        backend/src/test/java/com/omprakashgautam/homelab/spends/service/DataHealthServiceTest.java
git commit -m "feat: add DataHealthService with 3 unit tests"
```

---

## Task 3: Backend — Controller

**Files:**
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/DataHealthController.java`

- [ ] **Step 1: Create the controller**

Create `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/DataHealthController.java`:

```java
package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.DataHealthDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.DataHealthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/data-health")
@RequiredArgsConstructor
public class DataHealthController {

    private final DataHealthService dataHealthService;

    @GetMapping
    public ResponseEntity<DataHealthDto.Report> getReport(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        return ResponseEntity.ok(dataHealthService.getReport(principal.getId()));
    }
}
```

- [ ] **Step 2: Run full backend test suite**

```bash
cd backend && mvn test -q 2>&1 | tail -15
```

Expected: all tests pass, BUILD SUCCESS. (JVM deprecation warnings are acceptable.)

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/controller/DataHealthController.java
git commit -m "feat: add GET /api/data-health endpoint"
```

---

## Task 4: Frontend — API client + page + routing

**Files:**
- Create: `frontend/src/api/dataHealth.ts`
- Create: `frontend/src/pages/DataHealthPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Create the API client**

Create `frontend/src/api/dataHealth.ts`:

```typescript
import client from './client'

export interface TransactionStats {
  total: number
  uncategorized: number
  miscellaneous: number
  earliestDate: string | null
  latestDate: string | null
  accountCount: number
}

export interface RuleStats {
  userRules: number
  globalRules: number
}

export interface NearDuplicate {
  accountLabel: string
  date: string
  amount: number
  count: number
}

export interface DataHealthReport {
  transactions: TransactionStats
  rules: RuleStats
  nearDuplicates: NearDuplicate[]
}

export async function getDataHealthReport(): Promise<DataHealthReport> {
  const { data } = await client.get<DataHealthReport>('/data-health')
  return data
}
```

- [ ] **Step 2: Create the DataHealthPage**

Create `frontend/src/pages/DataHealthPage.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, AlertCircle, BookOpen, Copy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getDataHealthReport, type NearDuplicate } from '../api/dataHealth'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatAmount(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Health bar ────────────────────────────────────────────────────────────────

function HealthBar({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? 'bg-emerald-500' :
    pct >= 60 ? 'bg-amber-400' :
                'bg-red-500'
  return (
    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
      <div
        className={`h-3 rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
    </div>
  )
}

// ── Near-duplicate row ────────────────────────────────────────────────────────

function DupRow({ dup }: { dup: NearDuplicate }) {
  return (
    <tr className="border-t border-gray-100 dark:border-gray-700">
      <td className="py-3 pr-4 text-sm text-gray-700 dark:text-gray-300">{formatDate(dup.date)}</td>
      <td className="py-3 pr-4 text-sm text-gray-600 dark:text-gray-400 font-mono text-xs">{dup.accountLabel}</td>
      <td className="py-3 pr-4 text-sm font-medium text-gray-900 dark:text-white">{formatAmount(dup.amount)}</td>
      <td className="py-3 text-sm">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
          {dup.count}× duplicate
        </span>
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DataHealthPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['data-health'],
    queryFn: getDataHealthReport,
    staleTime: 5 * 60_000,
  })

  const wellCategorized = data
    ? Math.max(0, data.transactions.total - data.transactions.uncategorized - data.transactions.miscellaneous)
    : 0
  const categorizationPct = data && data.transactions.total > 0
    ? Math.round((wellCategorized / data.transactions.total) * 100)
    : 0

  const dateRange = data
    ? `${formatDate(data.transactions.earliestDate)} – ${formatDate(data.transactions.latestDate)}`
    : '—'

  if (isLoading) {
    return (
      <div className="p-4 sm:p-8 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            ))}
          </div>
          <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="p-4 sm:p-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>Failed to load data health report. Please try again.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-7 h-7 text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data Health</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Audit uncategorized transactions, rule coverage, and near-duplicate candidates
          </p>
        </div>
      </div>

      {/* Overview stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Transactions" value={data.transactions.total.toLocaleString()} />
        <StatCard label="Bank Accounts" value={data.transactions.accountCount} />
        <StatCard label="Date Range" value={dateRange} />
      </div>

      {/* Categorization health */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Categorization Health</h2>
          <span className={`text-2xl font-bold ${
            categorizationPct >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
            categorizationPct >= 60 ? 'text-amber-600 dark:text-amber-400' :
                                      'text-red-600 dark:text-red-400'
          }`}>
            {categorizationPct}%
          </span>
        </div>
        <HealthBar pct={categorizationPct} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {wellCategorized.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Well-categorized</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-400 mt-1 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {data.transactions.miscellaneous.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Fell through to Miscellaneous
              </p>
              {data.transactions.miscellaneous > 0 && (
                <Link
                  to="/transactions"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Review in Transactions →
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500 mt-1 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {data.transactions.uncategorized.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Uncategorized (null)</p>
            </div>
          </div>
        </div>
        {data.transactions.miscellaneous > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
            Tip: add more rules in{' '}
            <Link to="/rules" className="text-blue-600 dark:text-blue-400 hover:underline">Rules</Link>
            {' '}to reduce Miscellaneous transactions automatically on future imports.
          </p>
        )}
      </div>

      {/* Rule coverage */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Rule Coverage</h2>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {data.rules.userRules}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your custom rules</p>
            <Link
              to="/rules"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
            >
              Manage rules →
            </Link>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {data.rules.globalRules}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Built-in global rules</p>
          </div>
        </div>
      </div>

      {/* Near-duplicate candidates */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Copy className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Near-Duplicate Candidates
          </h2>
          {data.nearDuplicates.length > 0 && (
            <span className="ml-auto text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
              {data.nearDuplicates.length} group{data.nearDuplicates.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {data.nearDuplicates.length === 0 ? (
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-sm">No near-duplicate candidates found.</span>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              These transaction groups share the same account, date, and amount but different
              remarks — they may be accidental duplicates. Review them in Transactions.
            </p>
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="pb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide pr-4">Date</th>
                  <th className="pb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide pr-4">Account</th>
                  <th className="pb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide pr-4">Amount</th>
                  <th className="pb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.nearDuplicates.map((dup, i) => (
                  <DupRow key={i} dup={dup} />
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add route in App.tsx**

Open `frontend/src/App.tsx`. Find the block of `<Route>` definitions inside the `<ProtectedRoute>` wrapper. Add the import at the top:

```typescript
import DataHealthPage from './pages/DataHealthPage'
```

Add the route after the `reports` route:

```tsx
<Route path="data-health" element={<DataHealthPage />} />
```

The Routes block should now look like:
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
<Route path="recurring" element={<RecurringPage />} />
<Route path="reports" element={<ReportsPage />} />
<Route path="data-health" element={<DataHealthPage />} />
```

- [ ] **Step 4: Add nav link in Layout.tsx**

Open `frontend/src/components/Layout.tsx`.

Add `ShieldCheck` to the lucide-react import:

```typescript
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
} from 'lucide-react'
```

Add the nav entry to the `nav` array after the `reports` entry:

```typescript
const nav = [
  { to: '/',             label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/accounts',     label: 'Accounts',     icon: Building2 },
  { to: '/import',       label: 'Import',       icon: Upload },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budgets',      label: 'Budgets',      icon: PiggyBank },
  { to: '/household',    label: 'Household',    icon: Users },
  { to: '/views',        label: 'Views',        icon: LayoutGrid },
  { to: '/recurring',    label: 'Recurring',    icon: Repeat },
  { to: '/reports',      label: 'Reports',      icon: FileText },
  { to: '/data-health',  label: 'Data Health',  icon: ShieldCheck },
  { to: '/settings',     label: 'Settings',     icon: Settings },
]
```

- [ ] **Step 5: TypeScript compile check**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 6: Run backend tests to confirm nothing broke**

```bash
cd backend && mvn test -q 2>&1 | tail -10
```

Expected: BUILD SUCCESS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/dataHealth.ts \
        frontend/src/pages/DataHealthPage.tsx \
        frontend/src/App.tsx \
        frontend/src/components/Layout.tsx
git commit -m "feat: data health page — categorization health bar, rule coverage, near-duplicate candidates"
```
