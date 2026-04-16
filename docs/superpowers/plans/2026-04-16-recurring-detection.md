# Recurring Transaction Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically detect recurring transactions (salary, rent, subscriptions) from the last 13 months of data and surface them on a dedicated page and the dashboard.

**Architecture:** A new JPQL query groups transactions by merchant + calendar month, returning per-month averages. `RecurringService` post-processes these rows in Java: merchants with ≥3 monthly occurrences where amounts are consistent (within 20% variance) are classified as `MONTHLY` recurring patterns. The controller exposes `GET /api/recurring`. A `RecurringPage` lists all patterns; a dashboard banner links to it.

**Tech Stack:** Spring Boot 3.3.4 / Java 21 / JPA / JUnit 5 + Mockito (backend) · React 18 / TypeScript / TanStack Query / Tailwind (frontend)

---

## File Map

**Backend — new files**
- `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/RecurringDto.java`
- `backend/src/main/java/com/omprakashgautam/homelab/spends/service/RecurringService.java`
- `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/RecurringController.java`
- `backend/src/test/java/com/omprakashgautam/homelab/spends/service/RecurringServiceTest.java`

**Backend — modified files**
- `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionRepository.java` — add `merchantMonthlyActivity` query

**Frontend — new files**
- `frontend/src/api/recurring.ts`
- `frontend/src/pages/RecurringPage.tsx`

**Frontend — modified files**
- `frontend/src/App.tsx` — add `/recurring` route
- `frontend/src/components/Layout.tsx` — add Recurring nav link
- `frontend/src/pages/DashboardPage.tsx` — add recurring patterns banner

---

## Task 1: RecurringDto

**Files:**
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/RecurringDto.java`

- [ ] **Step 1: Create the DTO**

```java
package com.omprakashgautam.homelab.spends.dto;

import java.math.BigDecimal;
import java.util.List;

public class RecurringDto {

    public enum Frequency {
        MONTHLY
    }

    public record RecurringPattern(
            String merchantName,
            String categoryName,
            String categoryColor,
            Frequency frequency,
            BigDecimal averageAmount,
            int occurrences,
            String lastMonth,       // "yyyy-MM"
            String nextExpected,    // "yyyy-MM" — predicted next occurrence
            boolean activeThisMonth
    ) {}

    public record RecurringSummary(
            String month,                      // "April 2025"
            List<RecurringPattern> patterns
    ) {}
}
```

- [ ] **Step 2: Verify it compiles**

```bash
mvn -f backend/pom.xml compile -q
```

Expected: no output (success)

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/dto/RecurringDto.java
git commit -m "feat: add RecurringDto with RecurringSummary and RecurringPattern records"
```

---

## Task 2: TransactionRepository — merchantMonthlyActivity Query

**Files:**
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionRepository.java`

Read the file before editing. Add the following query method after the `topMerchants` method (before the final closing brace of the interface):

- [ ] **Step 1: Add the query**

```java
/**
 * Groups all non-null-merchant transactions by merchant + calendar month.
 * Returns one row per (merchant, month) with the average withdrawal,
 * average deposit, and transaction count. Used by RecurringService to
 * detect recurring patterns.
 *
 * Row layout: [merchantName, categoryName, categoryColor, yearMonth (yyyy-MM),
 *              avgWithdrawal, avgDeposit, count]
 */
@Query("""
        SELECT t.merchantName,
               t.category.name,
               t.category.color,
               FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM'),
               COALESCE(AVG(t.withdrawalAmount), 0),
               COALESCE(AVG(t.depositAmount), 0),
               COUNT(t)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from
          AND t.merchantName IS NOT NULL
          AND (t.withdrawalAmount > 0 OR t.depositAmount > 0)
        GROUP BY t.merchantName,
                 t.category.id,
                 t.category.name,
                 t.category.color,
                 FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM')
        ORDER BY t.merchantName,
                 FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM')
        """)
List<Object[]> merchantMonthlyActivity(@Param("userId") UUID userId,
                                        @Param("from") LocalDate from);
```

- [ ] **Step 2: Verify it compiles**

```bash
mvn -f backend/pom.xml compile -q
```

Expected: no output (success)

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionRepository.java
git commit -m "feat: add merchantMonthlyActivity query to TransactionRepository"
```

---

## Task 3: RecurringService with Unit Tests (TDD)

**Files:**
- Create: `backend/src/test/java/com/omprakashgautam/homelab/spends/service/RecurringServiceTest.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/RecurringService.java`

- [ ] **Step 1: Write the failing tests**

The test directory does not exist yet. Create the file (Maven will compile any `.java` file found under `src/test`):

```java
package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.RecurringDto;
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
class RecurringServiceTest {

    @Mock
    TransactionRepository transactionRepository;

    @InjectMocks
    RecurringService service;

    private static final UUID USER_ID = UUID.randomUUID();

    /** Helper: builds a single merchant-month row in the same layout as the JPQL query returns. */
    private static Object[] row(String merchant, String cat, String color,
                                String yearMonth, double withdrawal, double deposit, long count) {
        return new Object[]{
                merchant, cat, color, yearMonth,
                BigDecimal.valueOf(withdrawal), BigDecimal.valueOf(deposit), count
        };
    }

    @Test
    void detectsMonthlySubscription() {
        when(transactionRepository.latestTransactionDate(USER_ID))
                .thenReturn(LocalDate.of(2025, 4, 15));
        when(transactionRepository.merchantMonthlyActivity(eq(USER_ID), any()))
                .thenReturn(List.of(
                        row("Netflix", "Entertainment", "#ef4444", "2025-02", 649.0, 0, 1),
                        row("Netflix", "Entertainment", "#ef4444", "2025-03", 649.0, 0, 1),
                        row("Netflix", "Entertainment", "#ef4444", "2025-04", 649.0, 0, 1)
                ));

        RecurringDto.RecurringSummary result = service.getPatterns(USER_ID);

        assertThat(result.patterns()).hasSize(1);
        RecurringDto.RecurringPattern p = result.patterns().get(0);
        assertThat(p.merchantName()).isEqualTo("Netflix");
        assertThat(p.frequency()).isEqualTo(RecurringDto.Frequency.MONTHLY);
        assertThat(p.averageAmount()).isEqualByComparingTo("649.00");
        assertThat(p.occurrences()).isEqualTo(3);
        assertThat(p.activeThisMonth()).isTrue();
        assertThat(p.lastMonth()).isEqualTo("2025-04");
        assertThat(p.nextExpected()).isEqualTo("2025-05");
    }

    @Test
    void detectsMonthlyDeposit_salary() {
        when(transactionRepository.latestTransactionDate(USER_ID))
                .thenReturn(LocalDate.of(2025, 4, 15));
        when(transactionRepository.merchantMonthlyActivity(eq(USER_ID), any()))
                .thenReturn(List.of(
                        row("NEFT SALARY", "Income", "#22c55e", "2025-02", 0, 50000.0, 1),
                        row("NEFT SALARY", "Income", "#22c55e", "2025-03", 0, 50000.0, 1),
                        row("NEFT SALARY", "Income", "#22c55e", "2025-04", 0, 50000.0, 1)
                ));

        RecurringDto.RecurringSummary result = service.getPatterns(USER_ID);

        assertThat(result.patterns()).hasSize(1);
        assertThat(result.patterns().get(0).merchantName()).isEqualTo("NEFT SALARY");
        assertThat(result.patterns().get(0).averageAmount()).isEqualByComparingTo("50000.00");
    }

    @Test
    void ignoresMerchantWithOnlyTwoOccurrences() {
        when(transactionRepository.latestTransactionDate(USER_ID))
                .thenReturn(LocalDate.of(2025, 4, 15));
        when(transactionRepository.merchantMonthlyActivity(eq(USER_ID), any()))
                .thenReturn(List.of(
                        row("Swiggy", "Food & Dining", "#f97316", "2025-03", 500.0, 0, 3),
                        row("Swiggy", "Food & Dining", "#f97316", "2025-04", 600.0, 0, 4)
                ));

        RecurringDto.RecurringSummary result = service.getPatterns(USER_ID);

        assertThat(result.patterns()).isEmpty();
    }

    @Test
    void ignoresMerchantWithHighAmountVariance() {
        // Netflix at 649 in Feb, then 1299 in Mar (100% jump = well above 20% threshold)
        when(transactionRepository.latestTransactionDate(USER_ID))
                .thenReturn(LocalDate.of(2025, 4, 15));
        when(transactionRepository.merchantMonthlyActivity(eq(USER_ID), any()))
                .thenReturn(List.of(
                        row("Netflix", "Entertainment", "#ef4444", "2025-02", 649.0, 0, 1),
                        row("Netflix", "Entertainment", "#ef4444", "2025-03", 1299.0, 0, 1),
                        row("Netflix", "Entertainment", "#ef4444", "2025-04", 1299.0, 0, 1)
                ));

        RecurringDto.RecurringSummary result = service.getPatterns(USER_ID);

        assertThat(result.patterns()).isEmpty();
    }

    @Test
    void ignoresMerchantWithMixedDebitCredit() {
        // Same merchant has withdrawals some months and deposits other months — not a pattern
        when(transactionRepository.latestTransactionDate(USER_ID))
                .thenReturn(LocalDate.of(2025, 4, 15));
        when(transactionRepository.merchantMonthlyActivity(eq(USER_ID), any()))
                .thenReturn(List.of(
                        row("ICICI Bank", "Financial", "#3b82f6", "2025-02", 1000.0, 0, 1),
                        row("ICICI Bank", "Financial", "#3b82f6", "2025-03", 0, 2000.0, 1),
                        row("ICICI Bank", "Financial", "#3b82f6", "2025-04", 1000.0, 0, 1)
                ));

        RecurringDto.RecurringSummary result = service.getPatterns(USER_ID);

        assertThat(result.patterns()).isEmpty();
    }

    @Test
    void sortsByAverageAmountDescending() {
        when(transactionRepository.latestTransactionDate(USER_ID))
                .thenReturn(LocalDate.of(2025, 4, 15));
        when(transactionRepository.merchantMonthlyActivity(eq(USER_ID), any()))
                .thenReturn(List.of(
                        // Netflix ₹649 (cheap, added first)
                        row("Netflix", "Entertainment", "#ef4444", "2025-02", 649.0, 0, 1),
                        row("Netflix", "Entertainment", "#ef4444", "2025-03", 649.0, 0, 1),
                        row("Netflix", "Entertainment", "#ef4444", "2025-04", 649.0, 0, 1),
                        // Rent ₹25000 (expensive, added second)
                        row("RENT", "Rent & Housing", "#8b5cf6", "2025-02", 25000.0, 0, 1),
                        row("RENT", "Rent & Housing", "#8b5cf6", "2025-03", 25000.0, 0, 1),
                        row("RENT", "Rent & Housing", "#8b5cf6", "2025-04", 25000.0, 0, 1)
                ));

        RecurringDto.RecurringSummary result = service.getPatterns(USER_ID);

        assertThat(result.patterns()).hasSize(2);
        assertThat(result.patterns().get(0).merchantName()).isEqualTo("RENT");
        assertThat(result.patterns().get(1).merchantName()).isEqualTo("Netflix");
    }

    @Test
    void activeThisMonthFalseWhenNotSeenInAnchorMonth() {
        when(transactionRepository.latestTransactionDate(USER_ID))
                .thenReturn(LocalDate.of(2025, 4, 15));  // anchor = April 2025
        when(transactionRepository.merchantMonthlyActivity(eq(USER_ID), any()))
                .thenReturn(List.of(
                        row("Netflix", "Entertainment", "#ef4444", "2025-01", 649.0, 0, 1),
                        row("Netflix", "Entertainment", "#ef4444", "2025-02", 649.0, 0, 1),
                        row("Netflix", "Entertainment", "#ef4444", "2025-03", 649.0, 0, 1)
                        // NOT in 2025-04
                ));

        RecurringDto.RecurringSummary result = service.getPatterns(USER_ID);

        assertThat(result.patterns()).hasSize(1);
        assertThat(result.patterns().get(0).activeThisMonth()).isFalse();
        assertThat(result.patterns().get(0).nextExpected()).isEqualTo("2025-04");
    }
}
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
mvn -f backend/pom.xml test -Dtest=RecurringServiceTest 2>&1 | tail -15
```

Expected: compilation failure (`cannot find symbol: class RecurringService`) — this proves the test harness works.

- [ ] **Step 3: Write the service implementation**

```java
package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.RecurringDto;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RecurringService {

    private final TransactionRepository transactionRepository;

    static final int LOOKBACK_MONTHS = 13;
    static final int MIN_OCCURRENCES = 3;
    /** Max allowed (max-min)/min ratio across monthly amounts. */
    static final BigDecimal VARIANCE_THRESHOLD = new BigDecimal("0.20");

    private static final DateTimeFormatter MONTH_HEADER = DateTimeFormatter.ofPattern("MMMM yyyy");
    private static final DateTimeFormatter YEAR_MONTH_FMT = DateTimeFormatter.ofPattern("yyyy-MM");

    @Transactional(readOnly = true)
    public RecurringDto.RecurringSummary getPatterns(UUID userId) {
        LocalDate anchor = resolveAnchorMonth(userId);
        LocalDate from = anchor.minusMonths(LOOKBACK_MONTHS).withDayOfMonth(1);
        String anchorYM = anchor.format(YEAR_MONTH_FMT);

        List<Object[]> rows = transactionRepository.merchantMonthlyActivity(userId, from);

        // Group rows by merchantName → list of monthly rows
        Map<String, List<Object[]>> byMerchant = new LinkedHashMap<>();
        for (Object[] row : rows) {
            String merchant = (String) row[0];
            byMerchant.computeIfAbsent(merchant, k -> new ArrayList<>()).add(row);
        }

        List<RecurringDto.RecurringPattern> patterns = new ArrayList<>();

        for (Map.Entry<String, List<Object[]>> entry : byMerchant.entrySet()) {
            String merchant = entry.getKey();
            List<Object[]> monthRows = entry.getValue();

            if (monthRows.size() < MIN_OCCURRENCES) continue;

            // All months must be the same direction (all debit OR all credit)
            boolean allDebit  = monthRows.stream().allMatch(r -> ((BigDecimal) r[4]).compareTo(BigDecimal.ZERO) > 0);
            boolean allCredit = monthRows.stream().allMatch(r -> ((BigDecimal) r[5]).compareTo(BigDecimal.ZERO) > 0);
            if (!allDebit && !allCredit) continue;

            // Effective amount per month = the non-zero side
            List<BigDecimal> amounts = monthRows.stream()
                    .map(r -> allDebit ? (BigDecimal) r[4] : (BigDecimal) r[5])
                    .collect(Collectors.toList());

            // Check amount consistency: (max - min) / min ≤ VARIANCE_THRESHOLD
            BigDecimal minAmt = amounts.stream().min(Comparator.naturalOrder()).orElseThrow();
            BigDecimal maxAmt = amounts.stream().max(Comparator.naturalOrder()).orElseThrow();
            if (minAmt.compareTo(BigDecimal.ZERO) <= 0) continue;
            BigDecimal variance = maxAmt.subtract(minAmt).divide(minAmt, 4, RoundingMode.HALF_UP);
            if (variance.compareTo(VARIANCE_THRESHOLD) > 0) continue;

            // Average amount across months
            BigDecimal total = amounts.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal avgAmt = total.divide(BigDecimal.valueOf(amounts.size()), 2, RoundingMode.HALF_UP);

            // Category from first row
            String categoryName  = (String) monthRows.get(0)[1];
            String categoryColor = (String) monthRows.get(0)[2];

            // Months sorted chronologically
            List<String> months = monthRows.stream()
                    .map(r -> (String) r[3])
                    .sorted()
                    .collect(Collectors.toList());

            String lastMonth    = months.get(months.size() - 1);
            String nextExpected = YearMonth.parse(lastMonth, YEAR_MONTH_FMT)
                    .plusMonths(1)
                    .format(YEAR_MONTH_FMT);
            boolean activeThisMonth = months.contains(anchorYM);

            patterns.add(new RecurringDto.RecurringPattern(
                    merchant, categoryName, categoryColor,
                    RecurringDto.Frequency.MONTHLY,
                    avgAmt, months.size(),
                    lastMonth, nextExpected, activeThisMonth
            ));
        }

        // Sort by average amount descending (highest-value patterns first)
        patterns.sort(Comparator.comparing(RecurringDto.RecurringPattern::averageAmount).reversed());

        return new RecurringDto.RecurringSummary(anchor.format(MONTH_HEADER), patterns);
    }

    private LocalDate resolveAnchorMonth(UUID userId) {
        LocalDate latest = transactionRepository.latestTransactionDate(userId);
        return latest != null ? latest : LocalDate.now();
    }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
mvn -f backend/pom.xml test -Dtest=RecurringServiceTest 2>&1 | tail -10
```

Expected:
```
Tests run: 7, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/service/RecurringService.java \
        backend/src/test/java/com/omprakashgautam/homelab/spends/service/RecurringServiceTest.java
git commit -m "feat: add RecurringService with MONTHLY pattern detection (TDD, 7 tests)"
```

---

## Task 4: RecurringController

**Files:**
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/RecurringController.java`

- [ ] **Step 1: Create the controller**

```java
package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.RecurringDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.RecurringService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/recurring")
@RequiredArgsConstructor
public class RecurringController {

    private final RecurringService recurringService;

    @GetMapping
    public ResponseEntity<RecurringDto.RecurringSummary> getPatterns(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        return ResponseEntity.ok(recurringService.getPatterns(principal.getId()));
    }
}
```

- [ ] **Step 2: Full backend build to verify no regressions**

```bash
mvn -f backend/pom.xml package -DskipTests -q
```

Expected: no output (success)

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/controller/RecurringController.java
git commit -m "feat: add GET /api/recurring endpoint"
```

---

## Task 5: Frontend API Client

**Files:**
- Create: `frontend/src/api/recurring.ts`

- [ ] **Step 1: Create the API client**

```typescript
import client from './client'

export type Frequency = 'MONTHLY'

export interface RecurringPattern {
  merchantName: string
  categoryName: string | null
  categoryColor: string | null
  frequency: Frequency
  averageAmount: number
  occurrences: number
  lastMonth: string      // "yyyy-MM"
  nextExpected: string   // "yyyy-MM"
  activeThisMonth: boolean
}

export interface RecurringSummary {
  month: string                  // "April 2025"
  patterns: RecurringPattern[]
}

export async function getRecurring(): Promise<RecurringSummary> {
  const res = await client.get<RecurringSummary>('/recurring')
  return res.data
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build --prefix frontend 2>&1 | tail -5
```

Expected: `✓ built in Xs`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/recurring.ts
git commit -m "feat: add recurring API client with TypeScript types"
```

---

## Task 6: RecurringPage

**Files:**
- Create: `frontend/src/pages/RecurringPage.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { useQuery } from '@tanstack/react-query'
import { Repeat, Loader2, Calendar, TrendingDown, TrendingUp } from 'lucide-react'
import { clsx } from 'clsx'
import { getRecurring, type RecurringPattern } from '../api/recurring'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L'
  if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'K'
  return '₹' + n.toLocaleString('en-IN')
}

function fmtFull(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** "2025-04" → "Apr 2025" */
function fmtYearMonth(ym: string): string {
  const [year, month] = ym.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

// ── Pattern Card ──────────────────────────────────────────────────────────────

function PatternCard({ p }: { p: RecurringPattern }) {
  const isIncome = p.categoryName?.toLowerCase().includes('income') ||
                   p.categoryName?.toLowerCase().includes('salary')

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Direction icon */}
          <div className={clsx(
            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
            isIncome ? 'bg-green-50' : 'bg-blue-50'
          )}>
            {isIncome
              ? <TrendingUp className="w-4 h-4 text-green-600" />
              : <TrendingDown className="w-4 h-4 text-blue-600" />}
          </div>

          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{p.merchantName}</p>
            {p.categoryName && (
              <div className="flex items-center gap-1.5 mt-0.5">
                {p.categoryColor && (
                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: p.categoryColor }} />
                )}
                <span className="text-xs text-gray-500">{p.categoryName}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <p className="text-lg font-bold text-gray-900">{fmtFull(p.averageAmount)}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              Monthly
            </span>
            {p.activeThisMonth && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                Active
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-400 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>{p.occurrences} months detected</span>
        </div>
        <span>Last: {fmtYearMonth(p.lastMonth)}</span>
        <span>Next: {fmtYearMonth(p.nextExpected)}</span>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RecurringPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['recurring'],
    queryFn: getRecurring,
    staleTime: 5 * 60_000,
  })

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <p className="text-red-500">Failed to load recurring patterns.</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Repeat className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Recurring Transactions</h1>
        </div>
        <p className="text-sm text-gray-500">
          {data.month} · Patterns from the last 13 months
        </p>
      </div>

      {/* Info notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
        Merchants that appeared in <strong>3 or more months</strong> with a consistent
        amount (within 20% variation) are shown here. Salary, rent, and subscription services
        are typically detected automatically.
      </div>

      {/* Empty state */}
      {data.patterns.length === 0 && (
        <div className="text-center py-16">
          <Repeat className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-500">No recurring patterns detected</p>
          <p className="text-sm text-gray-400 mt-1">
            Import at least 3 months of statements to see patterns.
          </p>
        </div>
      )}

      {/* Pattern cards */}
      {data.patterns.length > 0 && (
        <>
          <p className="text-sm text-gray-500 mb-3">
            {data.patterns.length} pattern{data.patterns.length !== 1 ? 's' : ''} detected
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.patterns.map(p => (
              <PatternCard key={p.merchantName} p={p} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build --prefix frontend 2>&1 | tail -5
```

Expected: `✓ built in Xs`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/RecurringPage.tsx
git commit -m "feat: add RecurringPage showing detected recurring transaction patterns"
```

---

## Task 7: Wire Routing and Nav

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

Read both files before editing.

- [ ] **Step 1: Add route in `App.tsx`**

Add after the existing `import ViewDetailPage` line:

```typescript
import RecurringPage from './pages/RecurringPage'
```

Inside the protected route block, add after the `views/:id` route:

```tsx
          <Route path="recurring" element={<RecurringPage />} />
```

- [ ] **Step 2: Add nav link in `Layout.tsx`**

Add `Repeat` to the existing lucide-react import line (it already imports other icons from there).

In the `nav` array, add after the `Views` entry and before `Settings`:

```typescript
  { to: '/recurring', label: 'Recurring', icon: Repeat },
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build --prefix frontend 2>&1 | tail -5
```

Expected: `✓ built in Xs`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat: wire /recurring route and add Recurring nav link"
```

---

## Task 8: Dashboard Banner

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

Read `DashboardPage.tsx` before editing. The page already fetches `dashboard` and `alerts` via useQuery. Add a third query and a banner.

- [ ] **Step 1: Add import and query**

Add `Repeat` to the existing lucide-react import in `DashboardPage.tsx`:

```typescript
// In the existing lucide-react import, add Repeat to the list:
import {
  TrendingDown, TrendingUp, Wallet, BarChart3, ShoppingBag, ArrowRight,
  AlertTriangle, Sparkles, ChevronDown, ChevronUp, Repeat,
} from 'lucide-react'
```

Add the recurring API import after the existing `alerts` import:

```typescript
import { getRecurring, type RecurringSummary } from '../api/recurring'
```

Add the query inside `DashboardPage` after the existing `alertData` query:

```tsx
const { data: recurringData } = useQuery<RecurringSummary>({
  queryKey: ['recurring'],
  queryFn: getRecurring,
  staleTime: 5 * 60_000,
})
```

- [ ] **Step 2: Add the banner**

Find the section in `DashboardPage.tsx` where the alerts panel ends (look for the `</div>` after the alerts section, before the charts/stats). Insert the banner immediately after the alerts panel closing tag:

```tsx
      {/* Recurring patterns banner */}
      {recurringData && recurringData.patterns.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <Repeat className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>
              <span className="font-semibold">{recurringData.patterns.length}</span> recurring pattern
              {recurringData.patterns.length !== 1 ? 's' : ''} detected
              {' '}(salary, rent, subscriptions)
            </span>
          </div>
          <Link to="/recurring"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1 flex-shrink-0 ml-4">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build --prefix frontend 2>&1 | tail -5
```

Expected: `✓ built in Xs`

- [ ] **Step 4: Commit and push**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "feat: add recurring patterns banner on dashboard"
git push origin main
```

Expected: push succeeds; CI runs backend build + tests + frontend build.

---

## Self-Review

### Spec coverage

| Backlog requirement | Covered by task |
|---|---|
| Salary auto-identified | Task 3 (deposit direction detection) |
| Rent auto-identified | Task 3 (withdrawal consistency check) |
| Subscriptions auto-identified | Task 3 (Netflix/Hotstar/Jio patterns) |
| Recurring page | Task 6 |
| Routing + nav | Task 7 |
| Dashboard surfacing | Task 8 |
| Backend unit tests | Task 3 (7 test cases) |

### Detection algorithm constraints (by design)

- **Minimum 3 months** of history required — patterns with 1-2 months are noise.
- **20% amount variance** — allows for slight fluctuations (e.g., electricity bill ₹800–₹900) while excluding irregular merchants.
- **Same direction only** — a merchant that sometimes debits and sometimes credits is not classified as recurring.
- **Monthly only** — weekly and quarterly patterns are future work. The data grouping is by calendar month, so sub-monthly frequency is not detectable without day-level grouping.
- **Merchant name required** — transactions with null merchantName are excluded; they haven't been through merchant extraction and can't be matched reliably.
