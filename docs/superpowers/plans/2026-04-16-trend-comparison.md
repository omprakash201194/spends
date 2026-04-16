# Trend Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add percentage delta indicators to the four Dashboard stat cards showing how each metric changed vs the previous month and vs the same month last year, with a toggle to switch between the two comparisons.

**Architecture:** The backend fetches two extra sets of aggregates (prev month + prev year) using the already-existing `sumWithdrawals`, `sumDeposits`, and `countInPeriod` repository queries — no new SQL needed. Two `Comparison` values are appended to the existing `DashboardDto.Summary` record. The frontend adds a `[vs last month] / [vs last year]` toggle pill above the stat card grid, computes percentage deltas client-side, and renders coloured `↑`/`↓` badges inside `StatCard`.

**Tech Stack:** Spring Boot 3.3.4 / Java 21 (records, no-arg constructor not needed) · JUnit 5 + Mockito · React 18 + TypeScript · TanStack Query v5 · Tailwind CSS

---

## File Map

| File | Change |
|---|---|
| `backend/src/main/java/…/dto/DashboardDto.java` | Add `Comparison` record; add `prevMonth`/`prevYear` fields to `Summary` |
| `backend/src/main/java/…/service/DashboardService.java` | Fetch prev-month and prev-year aggregates, pass to `Summary` constructor |
| `backend/src/test/java/…/service/DashboardServiceTest.java` | **Create** — 3 unit tests |
| `frontend/src/api/dashboard.ts` | Add `Comparison` interface; add `prevMonth`/`prevYear` to `DashboardSummary` |
| `frontend/src/pages/DashboardPage.tsx` | Toggle state, delta helper, `DeltaBadge` component, update `StatCard` |

---

### Task 1: Backend — DTO + Service + Tests

**Files:**
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/DashboardDto.java`
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/DashboardService.java`
- Create: `backend/src/test/java/com/omprakashgautam/homelab/spends/service/DashboardServiceTest.java`

---

- [ ] **Step 1: Write the failing tests**

Create `backend/src/test/java/com/omprakashgautam/homelab/spends/service/DashboardServiceTest.java`:

```java
package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.DashboardDto;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock TransactionRepository transactionRepository;
    @InjectMocks DashboardService dashboardService;

    private static final UUID USER_ID = UUID.randomUUID();

    /** Stubs everything needed for getSummary() to run without NPE. */
    private void stubSharedQueries() {
        when(transactionRepository.categoryBreakdown(any(), any(), any())).thenReturn(List.of());
        when(transactionRepository.monthlyTrend(any(), any())).thenReturn(List.of());
        when(transactionRepository.topMerchants(any(), any(), any())).thenReturn(List.of());
    }

    @Test
    void getSummary_prevMonthFieldsMatchPreviousMonthAggregates() {
        LocalDate anchor = LocalDate.of(2025, 4, 15);
        when(transactionRepository.latestTransactionDate(USER_ID)).thenReturn(anchor);
        stubSharedQueries();

        // April 2025 — anchor
        LocalDate aprilFrom = LocalDate.of(2025, 4, 1);
        LocalDate aprilTo   = LocalDate.of(2025, 4, 30);
        when(transactionRepository.sumWithdrawals(USER_ID, aprilFrom, aprilTo)).thenReturn(new BigDecimal("10000"));
        when(transactionRepository.sumDeposits(USER_ID, aprilFrom, aprilTo)).thenReturn(new BigDecimal("50000"));
        when(transactionRepository.countInPeriod(USER_ID, aprilFrom, aprilTo)).thenReturn(20L);

        // March 2025 — prev month
        LocalDate marchFrom = LocalDate.of(2025, 3, 1);
        LocalDate marchTo   = LocalDate.of(2025, 3, 31);
        when(transactionRepository.sumWithdrawals(USER_ID, marchFrom, marchTo)).thenReturn(new BigDecimal("8000"));
        when(transactionRepository.sumDeposits(USER_ID, marchFrom, marchTo)).thenReturn(new BigDecimal("45000"));
        when(transactionRepository.countInPeriod(USER_ID, marchFrom, marchTo)).thenReturn(15L);

        // April 2024 — prev year
        LocalDate yearFrom = LocalDate.of(2024, 4, 1);
        LocalDate yearTo   = LocalDate.of(2024, 4, 30);
        when(transactionRepository.sumWithdrawals(USER_ID, yearFrom, yearTo)).thenReturn(new BigDecimal("9000"));
        when(transactionRepository.sumDeposits(USER_ID, yearFrom, yearTo)).thenReturn(new BigDecimal("48000"));
        when(transactionRepository.countInPeriod(USER_ID, yearFrom, yearTo)).thenReturn(18L);

        DashboardDto.Summary summary = dashboardService.getSummary(USER_ID);

        assertThat(summary.prevMonth().spent()).isEqualByComparingTo("8000");
        assertThat(summary.prevMonth().income()).isEqualByComparingTo("45000");
        assertThat(summary.prevMonth().transactionCount()).isEqualTo(15L);
    }

    @Test
    void getSummary_prevYearFieldsMatchSameMonthLastYear() {
        LocalDate anchor = LocalDate.of(2025, 4, 15);
        when(transactionRepository.latestTransactionDate(USER_ID)).thenReturn(anchor);
        stubSharedQueries();

        when(transactionRepository.sumWithdrawals(USER_ID, LocalDate.of(2025, 4, 1), LocalDate.of(2025, 4, 30))).thenReturn(new BigDecimal("10000"));
        when(transactionRepository.sumDeposits(USER_ID,    LocalDate.of(2025, 4, 1), LocalDate.of(2025, 4, 30))).thenReturn(new BigDecimal("50000"));
        when(transactionRepository.countInPeriod(USER_ID,  LocalDate.of(2025, 4, 1), LocalDate.of(2025, 4, 30))).thenReturn(20L);

        when(transactionRepository.sumWithdrawals(USER_ID, LocalDate.of(2025, 3, 1), LocalDate.of(2025, 3, 31))).thenReturn(BigDecimal.ZERO);
        when(transactionRepository.sumDeposits(USER_ID,    LocalDate.of(2025, 3, 1), LocalDate.of(2025, 3, 31))).thenReturn(BigDecimal.ZERO);
        when(transactionRepository.countInPeriod(USER_ID,  LocalDate.of(2025, 3, 1), LocalDate.of(2025, 3, 31))).thenReturn(0L);

        when(transactionRepository.sumWithdrawals(USER_ID, LocalDate.of(2024, 4, 1), LocalDate.of(2024, 4, 30))).thenReturn(new BigDecimal("9000"));
        when(transactionRepository.sumDeposits(USER_ID,    LocalDate.of(2024, 4, 1), LocalDate.of(2024, 4, 30))).thenReturn(new BigDecimal("48000"));
        when(transactionRepository.countInPeriod(USER_ID,  LocalDate.of(2024, 4, 1), LocalDate.of(2024, 4, 30))).thenReturn(18L);

        DashboardDto.Summary summary = dashboardService.getSummary(USER_ID);

        assertThat(summary.prevYear().spent()).isEqualByComparingTo("9000");
        assertThat(summary.prevYear().income()).isEqualByComparingTo("48000");
        assertThat(summary.prevYear().transactionCount()).isEqualTo(18L);
    }

    @Test
    void getSummary_prevMonthIsZeroWhenNoPreviousData() {
        LocalDate anchor = LocalDate.of(2025, 4, 15);
        when(transactionRepository.latestTransactionDate(USER_ID)).thenReturn(anchor);
        stubSharedQueries();
        // All aggregate queries return zero
        when(transactionRepository.sumWithdrawals(any(), any(), any())).thenReturn(BigDecimal.ZERO);
        when(transactionRepository.sumDeposits(any(), any(), any())).thenReturn(BigDecimal.ZERO);
        when(transactionRepository.countInPeriod(any(), any(), any())).thenReturn(0L);

        DashboardDto.Summary summary = dashboardService.getSummary(USER_ID);

        assertThat(summary.prevMonth().spent()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(summary.prevMonth().transactionCount()).isEqualTo(0L);
        assertThat(summary.prevYear().spent()).isEqualByComparingTo(BigDecimal.ZERO);
    }
}
```

- [ ] **Step 2: Run tests — expect compilation failure**

```bash
mvn -f backend/pom.xml test -pl . -Dtest=DashboardServiceTest -q 2>&1 | tail -20
```

Expected: FAIL — `DashboardDto.Comparison` does not exist yet, `DashboardDto.Summary` does not have `prevMonth`/`prevYear`.

- [ ] **Step 3: Add `Comparison` record and update `Summary` in `DashboardDto.java`**

Replace the entire `DashboardDto.java` with:

```java
package com.omprakashgautam.homelab.spends.dto;

import java.math.BigDecimal;
import java.util.List;

public class DashboardDto {

    public record CategoryStat(
            String name,
            String color,
            BigDecimal amount
    ) {}

    public record MonthlyTrend(
            String month,       // "Jan", "Feb", …
            String yearMonth,   // "2025-01" for sorting/keying
            BigDecimal spent,
            BigDecimal income
    ) {}

    public record MerchantStat(
            String merchant,
            BigDecimal amount,
            long count
    ) {}

    /**
     * Aggregate totals for a comparison period (prev month or prev year same month).
     */
    public record Comparison(
            BigDecimal spent,
            BigDecimal income,
            long transactionCount
    ) {}

    public record Summary(
            String month,               // "April 2025"
            BigDecimal totalSpent,
            BigDecimal totalIncome,
            BigDecimal netSavings,
            long transactionCount,
            List<CategoryStat> categoryBreakdown,
            List<MonthlyTrend> monthlyTrend,
            List<MerchantStat> topMerchants,
            Comparison prevMonth,       // aggregates for the month before anchor
            Comparison prevYear         // aggregates for same month one year ago
    ) {}
}
```

- [ ] **Step 4: Update `DashboardService.java` to fetch and attach comparison data**

In `getSummary`, add the prev-month and prev-year lookups immediately after computing `net`, before building the `Summary`. Replace the full `getSummary` method body:

```java
@Transactional(readOnly = true)
public DashboardDto.Summary getSummary(UUID userId) {
    LocalDate anchor  = resolveAnchorMonth(userId);
    LocalDate from    = anchor.withDayOfMonth(1);
    LocalDate to      = anchor.withDayOfMonth(anchor.lengthOfMonth());
    LocalDate trend12 = anchor.minusMonths(11).withDayOfMonth(1);

    BigDecimal spent  = transactionRepository.sumWithdrawals(userId, from, to);
    BigDecimal income = transactionRepository.sumDeposits(userId, from, to);
    long count        = transactionRepository.countInPeriod(userId, from, to);
    BigDecimal net    = income.subtract(spent);

    // Previous month (anchor − 1 month)
    LocalDate prevMonthDate = anchor.minusMonths(1);
    LocalDate prevMonthFrom = prevMonthDate.withDayOfMonth(1);
    LocalDate prevMonthTo   = prevMonthDate.withDayOfMonth(prevMonthDate.lengthOfMonth());
    DashboardDto.Comparison prevMonth = new DashboardDto.Comparison(
            transactionRepository.sumWithdrawals(userId, prevMonthFrom, prevMonthTo),
            transactionRepository.sumDeposits(userId, prevMonthFrom, prevMonthTo),
            transactionRepository.countInPeriod(userId, prevMonthFrom, prevMonthTo)
    );

    // Same month last year (anchor − 12 months)
    LocalDate prevYearDate = anchor.minusYears(1);
    LocalDate prevYearFrom = prevYearDate.withDayOfMonth(1);
    LocalDate prevYearTo   = prevYearDate.withDayOfMonth(prevYearDate.lengthOfMonth());
    DashboardDto.Comparison prevYear = new DashboardDto.Comparison(
            transactionRepository.sumWithdrawals(userId, prevYearFrom, prevYearTo),
            transactionRepository.sumDeposits(userId, prevYearFrom, prevYearTo),
            transactionRepository.countInPeriod(userId, prevYearFrom, prevYearTo)
    );

    List<DashboardDto.CategoryStat> categories = transactionRepository
            .categoryBreakdown(userId, from, to)
            .stream()
            .map(row -> new DashboardDto.CategoryStat(
                    (String) row[0],
                    (String) row[1],
                    (BigDecimal) row[2]
            ))
            .toList();

    List<DashboardDto.MonthlyTrend> trend = buildTrend(
            transactionRepository.monthlyTrend(userId, trend12),
            trend12, anchor
    );

    List<DashboardDto.MerchantStat> merchants = transactionRepository
            .topMerchants(userId, from, to)
            .stream()
            .map(row -> new DashboardDto.MerchantStat(
                    (String) row[0],
                    (BigDecimal) row[1],
                    (Long) row[2]
            ))
            .toList();

    return new DashboardDto.Summary(
            anchor.format(MONTH_HEADER),
            spent, income, net, count,
            categories, trend, merchants,
            prevMonth, prevYear
    );
}
```

(The `resolveAnchorMonth` and `buildTrend` private methods are unchanged.)

- [ ] **Step 5: Run tests — expect all 3 to pass**

```bash
mvn -f backend/pom.xml test -Dtest=DashboardServiceTest -q 2>&1 | tail -10
```

Expected: `BUILD SUCCESS`, 3 tests passed.

- [ ] **Step 6: Run the full test suite**

```bash
mvn -f backend/pom.xml test -q 2>&1 | tail -10
```

Expected: `BUILD SUCCESS`, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/dto/DashboardDto.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/service/DashboardService.java \
        backend/src/test/java/com/omprakashgautam/homelab/spends/service/DashboardServiceTest.java
git commit -m "feat: add prevMonth and prevYear comparison data to dashboard summary"
```

---

### Task 2: Frontend — Delta Badges on Stat Cards

**Files:**
- Modify: `frontend/src/api/dashboard.ts`
- Modify: `frontend/src/pages/DashboardPage.tsx`

---

- [ ] **Step 1: Extend the TypeScript types in `frontend/src/api/dashboard.ts`**

Add the `Comparison` interface and extend `DashboardSummary`. Replace the file with:

```typescript
import apiClient from './client'

export interface CategoryStat {
  name: string
  color: string
  amount: number
}

export interface MonthlyTrend {
  month: string      // "Jan"
  yearMonth: string  // "2025-01"
  spent: number
  income: number
}

export interface MerchantStat {
  merchant: string
  amount: number
  count: number
}

export interface Comparison {
  spent: number
  income: number
  transactionCount: number
}

export interface DashboardSummary {
  month: string
  totalSpent: number
  totalIncome: number
  netSavings: number
  transactionCount: number
  categoryBreakdown: CategoryStat[]
  monthlyTrend: MonthlyTrend[]
  topMerchants: MerchantStat[]
  prevMonth: Comparison
  prevYear: Comparison
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>('/dashboard/summary')
  return data
}
```

- [ ] **Step 2: Add `pctDelta` helper and `DeltaBadge` component to `DashboardPage.tsx`**

In the `// ── Helpers ───` section at the top of `DashboardPage.tsx`, add these two items after the `inrFull` function (before `// ── Page ──`):

```typescript
/** Returns percentage change from prev to current, or null if prev is zero. */
function pctDelta(current: number, prev: number): number | null {
  if (prev === 0) return null
  return ((current - prev) / prev) * 100
}
```

And add this component in the `// ── Sub-components ────` section, just before the `StatCard` function:

```tsx
function DeltaBadge({
  delta,
  positiveIsGood,
  label,
}: {
  delta: number | null
  positiveIsGood: boolean
  label: string
}) {
  if (delta === null) return null
  const isPositive = delta >= 0
  const isGood     = positiveIsGood ? isPositive : !isPositive
  const colorClass = isGood ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'
  const arrow      = isPositive ? '↑' : '↓'
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded ${colorClass}`}>
      {arrow} {Math.abs(delta).toFixed(1)}%
      <span className="text-gray-400 font-normal ml-1">{label}</span>
    </span>
  )
}
```

- [ ] **Step 3: Update `StatCard` to accept and render a delta badge**

Replace the existing `StatCard` function (currently at the end of the file in the sub-components section) with:

```tsx
function StatCard({
  label, value, sub, icon: Icon, iconColor, iconBg,
  delta, positiveIsGood, deltaLabel,
}: {
  label: string; value: string; sub: string
  icon: React.ElementType; iconColor: string; iconBg: string
  delta?: number | null; positiveIsGood?: boolean; deltaLabel?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs sm:text-sm font-medium text-gray-500">{label}</span>
        <span className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </span>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <p className="text-xs text-gray-400">{sub}</p>
        {delta !== undefined && delta !== null && positiveIsGood !== undefined && deltaLabel !== undefined && (
          <DeltaBadge delta={delta} positiveIsGood={positiveIsGood} label={deltaLabel} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add compare-mode toggle state and pass deltas to stat cards in `DashboardContent`**

In `DashboardContent`, add the toggle state at the top of the function body (after the `hasData` line):

```typescript
const [compareMode, setCompareMode] = useState<'month' | 'year'>('month')
const comp      = compareMode === 'month' ? data.prevMonth : data.prevYear
const compLabel = compareMode === 'month' ? 'last month' : 'last year'
```

Replace the existing stat card grid (the `<div className="grid grid-cols-2 lg:grid-cols-4 …">` block) with this version that includes the toggle pill above and passes delta props:

```tsx
{/* Compare mode toggle */}
<div className="flex justify-end mb-2">
  <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-xs">
    <button
      onClick={() => setCompareMode('month')}
      className={`px-3 py-1 rounded-md transition-colors ${
        compareMode === 'month'
          ? 'bg-gray-900 text-white font-medium'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      vs last month
    </button>
    <button
      onClick={() => setCompareMode('year')}
      className={`px-3 py-1 rounded-md transition-colors ${
        compareMode === 'year'
          ? 'bg-gray-900 text-white font-medium'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      vs last year
    </button>
  </div>
</div>

{/* Stat cards */}
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
  <StatCard
    label="Total Spent"
    value={inr(data.totalSpent)}
    sub={data.month}
    icon={TrendingDown}
    iconColor="text-red-500"
    iconBg="bg-red-50"
    delta={pctDelta(data.totalSpent, comp.spent)}
    positiveIsGood={false}
    deltaLabel={compLabel}
  />
  <StatCard
    label="Total Income"
    value={inr(data.totalIncome)}
    sub={data.month}
    icon={TrendingUp}
    iconColor="text-green-500"
    iconBg="bg-green-50"
    delta={pctDelta(data.totalIncome, comp.income)}
    positiveIsGood={true}
    deltaLabel={compLabel}
  />
  <StatCard
    label="Net Savings"
    value={inr(Math.abs(data.netSavings))}
    sub={data.netSavings >= 0 ? 'Surplus' : 'Deficit'}
    icon={Wallet}
    iconColor={data.netSavings >= 0 ? 'text-blue-500' : 'text-orange-500'}
    iconBg={data.netSavings >= 0 ? 'bg-blue-50' : 'bg-orange-50'}
  />
  <StatCard
    label="Transactions"
    value={data.transactionCount.toString()}
    sub={data.month}
    icon={BarChart3}
    iconColor="text-purple-500"
    iconBg="bg-purple-50"
    delta={pctDelta(data.transactionCount, comp.transactionCount)}
    positiveIsGood={false}
    deltaLabel={compLabel}
  />
</div>
```

Note: Net Savings is omitted from delta comparison because percentage change is misleading when the value can be negative or zero (e.g. surplus-to-deficit flip).

- [ ] **Step 5: Start the dev server and verify visually**

```bash
cd frontend && npm run dev
```

Open http://localhost:5173 and check:
1. Toggle pill appears above stat cards ("vs last month" / "vs last year")
2. Spent card shows a red badge when spending increased, green when decreased
3. Income card shows a green badge when income increased, red when decreased
4. Transactions card shows a badge with appropriate colour
5. Net Savings card shows no delta badge
6. Clicking "vs last year" switches all badges to year-over-year comparison
7. Badge shows nothing (no badge) when the comparison period has zero data

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/dashboard.ts frontend/src/pages/DashboardPage.tsx
git commit -m "feat: add trend comparison delta badges to dashboard stat cards"
```

---

## Self-Review

**Spec coverage:**
- ✅ Delta indicators on stat cards — Tasks 1 + 2
- ✅ vs last month comparison — Task 1 (prevMonth) + Task 2 (toggle default)
- ✅ vs same month last year — Task 1 (prevYear) + Task 2 (toggle "vs last year")
- ✅ Toggle between the two comparisons — Task 2 (compare-mode toggle pill)
- ✅ Colour coding (good/bad) — DeltaBadge with `positiveIsGood` prop
- ✅ No delta on Net Savings (avoids misleading % on negative values) — documented in Task 2

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency:**
- `Comparison` record fields: `spent`, `income`, `transactionCount` — used consistently in DTO, Service, Test, and TypeScript interface.
- `pctDelta(current, prev)` defined in Task 2 Step 2, used in Task 2 Step 4. ✅
- `DeltaBadge` defined in Task 2 Step 2, used in `StatCard` in Task 2 Step 3. ✅
- `compareMode`, `comp`, `compLabel` defined in Task 2 Step 4 and used in the same step. ✅
