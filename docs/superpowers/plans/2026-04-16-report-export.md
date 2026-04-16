# Phase 13 — Report Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CSV export for filtered transactions plus a yearly Reports page with monthly summary table, CSV download, and browser-print support.

**Architecture:** Two new backend endpoints — `GET /api/export/transactions` (streams a CSV filtered by the same params as the transaction list) and `GET /api/reports/monthly-summary?year=YYYY` (returns JSON for the Reports page). The frontend fetches with the JWT header and triggers a blob download for CSV files. The Reports page generates its own CSV client-side from the JSON. No new dependencies on either side.

**Tech Stack:** Spring Boot 3.3.4 · JPA Specification (already used in TransactionService) · Java `StringBuilder` for CSV · React 18 + TanStack Query v5 · Tailwind `print:` classes for browser print

---

## File Structure

**Backend — new files:**
- `service/ExportService.java` — builds CSV string from a `List<Transaction>`; RFC 4180 escaping
- `controller/ExportController.java` — `GET /api/export/transactions`; returns `byte[]` with `Content-Disposition: attachment`
- `dto/ReportDto.java` — records: `MonthRow`, `CategoryRow`, `YearSummary`
- `service/ReportService.java` — queries monthly trend + category breakdown; zero-fills missing months
- `controller/ReportController.java` — `GET /api/reports/available-years` + `GET /api/reports/monthly-summary?year=YYYY`

**Backend — modified files:**
- `service/TransactionService.java` — add `listAll(...)` (all matching rows, no pagination; reuses `buildSpec`)
- `repository/TransactionRepository.java` — add `availableYears(userId)` JPQL query

**Backend — test files:**
- `service/ExportServiceTest.java` — unit tests for CSV generation and escaping
- `service/ReportServiceTest.java` — unit tests for zero-fill, grand totals, year filtering

**Frontend — new files:**
- `src/api/export.ts` — `downloadTransactionsCsv(params)` (fetch + blob trigger)
- `src/api/reports.ts` — `getAvailableYears()`, `getMonthlySummary(year)`
- `src/pages/ReportsPage.tsx` — year picker, stat cards, monthly table, Export CSV + Print buttons

**Frontend — modified files:**
- `src/pages/TransactionPage.tsx` — add "Export CSV" button to header; passes current filter state
- `src/App.tsx` — add `/reports` route
- `src/components/Layout.tsx` — add Reports nav link (`FileText` icon)

---

## Task 1: Backend — TransactionService.listAll + ExportService + ExportController

**Files:**
- Modify: `spends/backend/src/main/java/com/omprakashgautam/homelab/spends/service/TransactionService.java`
- Create: `spends/backend/src/main/java/com/omprakashgautam/homelab/spends/service/ExportService.java`
- Create: `spends/backend/src/main/java/com/omprakashgautam/homelab/spends/controller/ExportController.java`
- Create: `spends/backend/src/test/java/com/omprakashgautam/homelab/spends/service/ExportServiceTest.java`

- [ ] **Step 1: Write the failing test**

Create `ExportServiceTest.java`:

```java
package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.model.BankAccount;
import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.Transaction;
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
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExportServiceTest {

    @Mock
    TransactionService transactionService;

    @InjectMocks
    ExportService exportService;

    // ── CSV escaping unit tests (no mock needed) ──────────────────────────────

    @Test
    void escape_nullReturnsEmpty() {
        assertThat(ExportService.escape(null)).isEmpty();
    }

    @Test
    void escape_plainTextUnchanged() {
        assertThat(ExportService.escape("Swiggy")).isEqualTo("Swiggy");
    }

    @Test
    void escape_commaWrapsInQuotes() {
        assertThat(ExportService.escape("Swiggy, Zomato")).isEqualTo("\"Swiggy, Zomato\"");
    }

    @Test
    void escape_doubleQuoteEscapedAndWrapped() {
        assertThat(ExportService.escape("She said \"hi\"")).isEqualTo("\"She said \"\"hi\"\"\"");
    }

    // ── CSV generation tests ──────────────────────────────────────────────────

    @Test
    void csv_headerRow_isPresent() {
        when(transactionService.listAll(any(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull()))
                .thenReturn(List.of());

        String csv = exportService.exportTransactionsCsv(
                UUID.randomUUID(), null, null, null, null, null, null);

        String header = csv.split("\n")[0];
        assertThat(header).isEqualTo(
                "Date,Transaction Date,Merchant,Category,Withdrawal (INR),Deposit (INR),Balance (INR),Remarks,Account");
    }

    @Test
    void csv_emptyList_returnsOnlyHeader() {
        when(transactionService.listAll(any(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull()))
                .thenReturn(List.of());

        String csv = exportService.exportTransactionsCsv(
                UUID.randomUUID(), null, null, null, null, null, null);

        assertThat(csv.split("\n")).hasSize(1);
    }

    @Test
    void csv_remarkWithComma_isQuoted() {
        Transaction tx = buildTx("Paid to Swiggy, online", "Food & Dining", new BigDecimal("500.00"), BigDecimal.ZERO);
        when(transactionService.listAll(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(tx));

        String csv = exportService.exportTransactionsCsv(
                UUID.randomUUID(), null, null, null, null, null, null);

        assertThat(csv).contains("\"Paid to Swiggy, online\"");
    }

    @Test
    void csv_nullCategory_writesEmpty() {
        Transaction tx = buildTxNoCategory("plain remark", new BigDecimal("200.00"), BigDecimal.ZERO);
        when(transactionService.listAll(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(tx));

        String csv = exportService.exportTransactionsCsv(
                UUID.randomUUID(), null, null, null, null, null, null);

        // line 2 (data row), category column (index 3) should be empty — two consecutive commas
        String dataRow = csv.split("\n")[1];
        String[] cols = dataRow.split(",", -1);
        assertThat(cols[3]).isEmpty();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Transaction buildTx(String remarks, String categoryName,
                                BigDecimal withdrawal, BigDecimal deposit) {
        Category cat = Category.builder()
                .id(UUID.randomUUID())
                .name(categoryName)
                .color("#ef4444")
                .build();
        BankAccount acct = BankAccount.builder()
                .id(UUID.randomUUID())
                .bankName("ICICI Bank")
                .currency("INR")
                .build();
        return Transaction.builder()
                .id(UUID.randomUUID())
                .valueDate(LocalDate.of(2025, 4, 1))
                .transactionDate(LocalDate.of(2025, 4, 1))
                .rawRemarks(remarks)
                .merchantName("TestMerchant")
                .withdrawalAmount(withdrawal)
                .depositAmount(deposit)
                .balance(new BigDecimal("10000.00"))
                .category(cat)
                .bankAccount(acct)
                .build();
    }

    private Transaction buildTxNoCategory(String remarks, BigDecimal withdrawal, BigDecimal deposit) {
        BankAccount acct = BankAccount.builder()
                .id(UUID.randomUUID())
                .bankName("ICICI Bank")
                .currency("INR")
                .build();
        return Transaction.builder()
                .id(UUID.randomUUID())
                .valueDate(LocalDate.of(2025, 4, 1))
                .transactionDate(LocalDate.of(2025, 4, 1))
                .rawRemarks(remarks)
                .merchantName("TestMerchant")
                .withdrawalAmount(withdrawal)
                .depositAmount(deposit)
                .build();
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd spends
mvn -f backend/pom.xml test -pl backend -Dtest=ExportServiceTest -q 2>&1 | tail -20
```

Expected: compilation errors — `ExportService` and `TransactionService.listAll` do not exist yet.

- [ ] **Step 3: Add `listAll` to TransactionService**

Open `spends/backend/src/main/java/com/omprakashgautam/homelab/spends/service/TransactionService.java`.

After the existing `list(...)` method (around line 71), add:

```java
    /**
     * Returns all transactions matching the given filters without pagination.
     * Used by ExportService to generate CSV downloads.
     * Sort: most recent first (valueDate DESC).
     */
    @Transactional(readOnly = true)
    public List<Transaction> listAll(UUID userId, String search, UUID categoryId,
                                     UUID accountId, String type,
                                     LocalDate dateFrom, LocalDate dateTo) {
        Specification<Transaction> spec = buildSpec(userId, search, categoryId, accountId, type, dateFrom, dateTo);
        return transactionRepository.findAll(spec, Sort.by("valueDate").descending());
    }
```

The `buildSpec` and `Sort` import are already present in the file. No other changes to the file.

- [ ] **Step 4: Create ExportService.java**

```java
package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.model.Transaction;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ExportService {

    private final TransactionService transactionService;

    /**
     * Queries all transactions matching the given filters and returns them as an RFC 4180 CSV string.
     * Columns: Date, Transaction Date, Merchant, Category, Withdrawal (INR), Deposit (INR),
     *          Balance (INR), Remarks, Account
     */
    @Transactional(readOnly = true)
    public String exportTransactionsCsv(UUID userId, String search, UUID categoryId,
                                        UUID accountId, String type,
                                        LocalDate dateFrom, LocalDate dateTo) {
        List<Transaction> transactions = transactionService.listAll(
                userId, search, categoryId, accountId, type, dateFrom, dateTo);

        StringBuilder sb = new StringBuilder(
                "Date,Transaction Date,Merchant,Category,Withdrawal (INR),Deposit (INR),Balance (INR),Remarks,Account\n");

        for (Transaction tx : transactions) {
            sb.append(escape(tx.getValueDate().toString())).append(',')
              .append(escape(tx.getTransactionDate().toString())).append(',')
              .append(escape(tx.getMerchantName())).append(',')
              .append(escape(tx.getCategory() != null ? tx.getCategory().getName() : "")).append(',')
              .append(tx.getWithdrawalAmount()).append(',')
              .append(tx.getDepositAmount()).append(',')
              .append(tx.getBalance() != null ? tx.getBalance() : "").append(',')
              .append(escape(tx.getRawRemarks())).append(',')
              .append(escape(tx.getBankAccount().getBankName())).append('\n');
        }

        return sb.toString();
    }

    /**
     * RFC 4180: if value contains comma, double-quote, CR, or LF — wrap in double-quotes
     * and double any internal double-quotes.
     */
    static String escape(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n") || value.contains("\r")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
```

- [ ] **Step 5: Create ExportController.java**

```java
package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.ExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/export")
@RequiredArgsConstructor
public class ExportController {

    private final ExportService exportService;

    /**
     * Downloads all transactions matching the provided filters as a CSV file.
     * Accepts the same filter params as GET /api/transactions (minus pagination/sort).
     */
    @GetMapping("/transactions")
    public ResponseEntity<byte[]> exportTransactions(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UUID categoryId,
            @RequestParam(required = false) UUID accountId,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo) {

        String csv = exportService.exportTransactionsCsv(
                principal.getId(), search, categoryId, accountId, type, dateFrom, dateTo);
        byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);
        String filename = "transactions-" + LocalDate.now() + ".csv";

        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                .header("Content-Type", "text/csv; charset=UTF-8")
                .body(bytes);
    }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
mvn -f backend/pom.xml test -pl backend -Dtest=ExportServiceTest -q 2>&1 | tail -20
```

Expected: `BUILD SUCCESS` with all tests green (8 tests).

- [ ] **Step 7: Run all backend tests**

```bash
mvn -f backend/pom.xml test -pl backend -q 2>&1 | tail -20
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 8: Commit**

```bash
cd spends
git add backend/src/main/java/com/omprakashgautam/homelab/spends/service/TransactionService.java
git add backend/src/main/java/com/omprakashgautam/homelab/spends/service/ExportService.java
git add backend/src/main/java/com/omprakashgautam/homelab/spends/controller/ExportController.java
git add backend/src/test/java/com/omprakashgautam/homelab/spends/service/ExportServiceTest.java
git commit -m "feat: add transaction CSV export endpoint (GET /api/export/transactions)"
```

---

## Task 2: Backend — ReportDto + availableYears query + ReportService + ReportController

**Files:**
- Create: `spends/backend/src/main/java/com/omprakashgautam/homelab/spends/dto/ReportDto.java`
- Modify: `spends/backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionRepository.java`
- Create: `spends/backend/src/main/java/com/omprakashgautam/homelab/spends/service/ReportService.java`
- Create: `spends/backend/src/main/java/com/omprakashgautam/homelab/spends/controller/ReportController.java`
- Create: `spends/backend/src/test/java/com/omprakashgautam/homelab/spends/service/ReportServiceTest.java`

- [ ] **Step 1: Write the failing test**

Create `ReportServiceTest.java`:

```java
package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.ReportDto;
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
class ReportServiceTest {

    @Mock
    TransactionRepository transactionRepository;

    @InjectMocks
    ReportService reportService;

    private static final UUID USER_ID = UUID.randomUUID();

    @Test
    void monthlySummary_alwaysReturns12Months() {
        when(transactionRepository.monthlyTrend(any(), any())).thenReturn(List.of());
        when(transactionRepository.categorySpendByMonth(any(), any(), any())).thenReturn(List.of());

        ReportDto.YearSummary summary = reportService.getMonthlySummary(USER_ID, 2025);

        assertThat(summary.months()).hasSize(12);
    }

    @Test
    void monthlySummary_zeroFillsMissingMonths() {
        // Only January and March have data; Feb and the rest should be zero
        List<Object[]> trend = List.of(
                new Object[]{"2025-01", new BigDecimal("5000"), new BigDecimal("45000")},
                new Object[]{"2025-03", new BigDecimal("3000"), new BigDecimal("0")}
        );
        when(transactionRepository.monthlyTrend(any(), any())).thenReturn(trend);
        when(transactionRepository.categorySpendByMonth(any(), any(), any())).thenReturn(List.of());

        ReportDto.YearSummary summary = reportService.getMonthlySummary(USER_ID, 2025);

        assertThat(summary.months().get(0).totalSpent()).isEqualByComparingTo("5000");
        assertThat(summary.months().get(1).totalSpent()).isEqualByComparingTo("0"); // Feb: zero
        assertThat(summary.months().get(2).totalSpent()).isEqualByComparingTo("3000");
    }

    @Test
    void monthlySummary_grandTotalsSum() {
        List<Object[]> trend = List.of(
                new Object[]{"2025-01", new BigDecimal("5000"), new BigDecimal("45000")},
                new Object[]{"2025-06", new BigDecimal("3000"), new BigDecimal("0")}
        );
        when(transactionRepository.monthlyTrend(any(), any())).thenReturn(trend);
        when(transactionRepository.categorySpendByMonth(any(), any(), any())).thenReturn(List.of());

        ReportDto.YearSummary summary = reportService.getMonthlySummary(USER_ID, 2025);

        assertThat(summary.grandTotalSpent()).isEqualByComparingTo("8000");
        assertThat(summary.grandTotalIncome()).isEqualByComparingTo("45000");
    }

    @Test
    void monthlySummary_filtersOutOtherYears() {
        // A row from 2024 must NOT appear in a 2025 report
        List<Object[]> trend = List.of(
                new Object[]{"2025-01", new BigDecimal("5000"), new BigDecimal("0")},
                new Object[]{"2024-12", new BigDecimal("9999"), new BigDecimal("0")}
        );
        when(transactionRepository.monthlyTrend(any(), any())).thenReturn(trend);
        when(transactionRepository.categorySpendByMonth(any(), any(), any())).thenReturn(List.of());

        ReportDto.YearSummary summary = reportService.getMonthlySummary(USER_ID, 2025);

        assertThat(summary.grandTotalSpent()).isEqualByComparingTo("5000");
    }

    @Test
    void monthlySummary_categoryRowsAreAttachedToCorrectMonth() {
        List<Object[]> trend = List.of(
                new Object[]{"2025-04", new BigDecimal("8000"), new BigDecimal("0")}
        );
        List<Object[]> cats = List.of(
                new Object[]{"2025-04", "Food & Dining", "#ef4444", new BigDecimal("3500")},
                new Object[]{"2025-04", "Transport",     "#3b82f6", new BigDecimal("1200")}
        );
        when(transactionRepository.monthlyTrend(any(), any())).thenReturn(trend);
        when(transactionRepository.categorySpendByMonth(any(), any(), any())).thenReturn(cats);

        ReportDto.YearSummary summary = reportService.getMonthlySummary(USER_ID, 2025);

        // April is month index 3 (0-based)
        ReportDto.MonthRow april = summary.months().get(3);
        assertThat(april.categories()).hasSize(2);
        assertThat(april.categories().get(0).category()).isEqualTo("Food & Dining");
        assertThat(april.categories().get(0).amount()).isEqualByComparingTo("3500");
    }

    @Test
    void getAvailableYears_returnsCurrentYearWhenNoData() {
        when(transactionRepository.availableYears(any())).thenReturn(List.of());

        List<Integer> years = reportService.getAvailableYears(USER_ID);

        assertThat(years).containsExactly(LocalDate.now().getYear());
    }

    @Test
    void getAvailableYears_returnsDbResultsWhenPresent() {
        when(transactionRepository.availableYears(any())).thenReturn(List.of(2025, 2024, 2023));

        List<Integer> years = reportService.getAvailableYears(USER_ID);

        assertThat(years).containsExactly(2025, 2024, 2023);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
mvn -f backend/pom.xml test -pl backend -Dtest=ReportServiceTest -q 2>&1 | tail -20
```

Expected: compilation errors — `ReportService`, `ReportDto`, `availableYears` do not exist yet.

- [ ] **Step 3: Create ReportDto.java**

```java
package com.omprakashgautam.homelab.spends.dto;

import java.math.BigDecimal;
import java.util.List;

public class ReportDto {

    public record CategoryRow(
            String category,
            String color,
            BigDecimal amount
    ) {}

    public record MonthRow(
            String yearMonth,     // "2025-04"
            String monthLabel,    // "April 2025"
            BigDecimal totalSpent,
            BigDecimal totalIncome,
            BigDecimal net,
            List<CategoryRow> categories
    ) {}

    public record YearSummary(
            int year,
            List<MonthRow> months,
            BigDecimal grandTotalSpent,
            BigDecimal grandTotalIncome
    ) {}
}
```

- [ ] **Step 4: Add `availableYears` query to TransactionRepository**

Open `TransactionRepository.java` and add after the `latestTransactionDateForHousehold` query (around line 160):

```java
    // ── Reports: distinct years with transaction data ──────────────────────────

    @Query("""
        SELECT DISTINCT YEAR(t.valueDate)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
        ORDER BY YEAR(t.valueDate) DESC
        """)
    List<Integer> availableYears(@Param("userId") UUID userId);
```

`YEAR()` is a Hibernate 6 date function that maps to `EXTRACT(YEAR FROM ...)`. Return type `List<Integer>` works directly.

- [ ] **Step 5: Create ReportService.java**

```java
package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.ReportDto;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final TransactionRepository transactionRepository;

    private static final DateTimeFormatter MONTH_LABEL = DateTimeFormatter.ofPattern("MMMM yyyy");

    @Transactional(readOnly = true)
    public List<Integer> getAvailableYears(UUID userId) {
        List<Integer> years = transactionRepository.availableYears(userId);
        return years.isEmpty() ? List.of(LocalDate.now().getYear()) : years;
    }

    @Transactional(readOnly = true)
    public ReportDto.YearSummary getMonthlySummary(UUID userId, int year) {
        LocalDate from = LocalDate.of(year, 1, 1);
        LocalDate to   = LocalDate.of(year, 12, 31);

        // monthlyTrend returns [yearMonth, sumWithdrawal, sumDeposit] for all months >= from
        List<Object[]> trendRows = transactionRepository.monthlyTrend(userId, from);
        Map<String, Object[]> trendByYM = new HashMap<>();
        for (Object[] row : trendRows) {
            String ym = (String) row[0];
            // Only keep rows that belong to the requested year
            if (ym.startsWith(year + "-")) {
                trendByYM.put(ym, row);
            }
        }

        // categorySpendByMonth returns [yearMonth, categoryName, categoryColor, sumWithdrawal]
        List<Object[]> catRows = transactionRepository.categorySpendByMonth(userId, from, to);
        Map<String, List<ReportDto.CategoryRow>> catsByYM = new HashMap<>();
        for (Object[] row : catRows) {
            String ym = (String) row[0];
            catsByYM.computeIfAbsent(ym, k -> new ArrayList<>())
                    .add(new ReportDto.CategoryRow(
                            (String) row[1],
                            (String) row[2],
                            (BigDecimal) row[3]
                    ));
        }

        List<ReportDto.MonthRow> months = new ArrayList<>(12);
        BigDecimal grandSpent  = BigDecimal.ZERO;
        BigDecimal grandIncome = BigDecimal.ZERO;

        for (int m = 1; m <= 12; m++) {
            String ym = String.format("%d-%02d", year, m);
            String label = LocalDate.of(year, m, 1).format(MONTH_LABEL);

            Object[] trend  = trendByYM.get(ym);
            BigDecimal spent  = trend != null ? (BigDecimal) trend[1] : BigDecimal.ZERO;
            BigDecimal income = trend != null ? (BigDecimal) trend[2] : BigDecimal.ZERO;
            BigDecimal net    = income.subtract(spent);

            List<ReportDto.CategoryRow> cats = catsByYM.getOrDefault(ym, List.of());

            months.add(new ReportDto.MonthRow(ym, label, spent, income, net, cats));
            grandSpent  = grandSpent.add(spent);
            grandIncome = grandIncome.add(income);
        }

        return new ReportDto.YearSummary(year, months, grandSpent, grandIncome);
    }
}
```

- [ ] **Step 6: Create ReportController.java**

```java
package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.ReportDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/available-years")
    public ResponseEntity<List<Integer>> getAvailableYears(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        return ResponseEntity.ok(reportService.getAvailableYears(principal.getId()));
    }

    @GetMapping("/monthly-summary")
    public ResponseEntity<ReportDto.YearSummary> getMonthlySummary(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestParam int year) {
        return ResponseEntity.ok(reportService.getMonthlySummary(principal.getId(), year));
    }
}
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
mvn -f backend/pom.xml test -pl backend -Dtest=ReportServiceTest -q 2>&1 | tail -20
```

Expected: `BUILD SUCCESS` with all 7 tests green.

- [ ] **Step 8: Run all backend tests**

```bash
mvn -f backend/pom.xml test -pl backend -q 2>&1 | tail -20
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 9: Commit**

```bash
cd spends
git add backend/src/main/java/com/omprakashgautam/homelab/spends/dto/ReportDto.java
git add backend/src/main/java/com/omprakashgautam/homelab/spends/service/ReportService.java
git add backend/src/main/java/com/omprakashgautam/homelab/spends/controller/ReportController.java
git add backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionRepository.java
git add backend/src/test/java/com/omprakashgautam/homelab/spends/service/ReportServiceTest.java
git commit -m "feat: add monthly report JSON endpoints (GET /api/reports/monthly-summary)"
```

---

## Task 3: Frontend — Export API utility + TransactionPage export button

**Files:**
- Create: `spends/frontend/src/api/export.ts`
- Modify: `spends/frontend/src/pages/TransactionPage.tsx`

- [ ] **Step 1: Create export.ts**

```typescript
// spends/frontend/src/api/export.ts
import { useAuthStore } from '../store/authStore'

export interface TransactionExportParams {
  search?: string
  categoryId?: string
  accountId?: string
  type?: string
  dateFrom?: string
  dateTo?: string
}

/**
 * Fetches GET /api/export/transactions with the JWT header,
 * receives the CSV blob, and triggers a browser file download.
 */
export async function downloadTransactionsCsv(params: TransactionExportParams): Promise<void> {
  const token = useAuthStore.getState().token
  const url = new URL('/api/export/transactions', window.location.origin)

  if (params.search)                          url.searchParams.set('search', params.search)
  if (params.categoryId)                      url.searchParams.set('categoryId', params.categoryId)
  if (params.accountId)                       url.searchParams.set('accountId', params.accountId)
  if (params.type && params.type !== 'ALL')   url.searchParams.set('type', params.type)
  if (params.dateFrom)                        url.searchParams.set('dateFrom', params.dateFrom)
  if (params.dateTo)                          url.searchParams.set('dateTo', params.dateTo)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Export failed')

  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objectUrl)
}
```

- [ ] **Step 2: Add the Export CSV button to TransactionPage**

Open `spends/frontend/src/pages/TransactionPage.tsx`.

**2a — Add import at the top of the file** (after the existing imports):

```typescript
import { Download } from 'lucide-react'
import { downloadTransactionsCsv } from '../api/export'
```

**2b — Add export state inside the `TransactionPage` component** (after the existing state declarations, before `return`):

```typescript
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      await downloadTransactionsCsv({
        search: debouncedSearch || undefined,
        categoryId: categoryId || undefined,
        accountId: accountId || undefined,
        type,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
    } finally {
      setExporting(false)
    }
  }
```

**2c — Add export button to the header** (in the JSX, locate the `<div className="flex items-center justify-between mb-4">` and add the button alongside the existing "Clear filters" button):

Find this block:
```tsx
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          {data && (
            <p className="text-sm text-gray-500 mt-0.5">
              {data.totalElements.toLocaleString()} transactions
            </p>
          )}
        </div>
        {hasFilters && (
          <button onClick={resetFilters} className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Clear filters
          </button>
        )}
      </div>
```

Replace with:
```tsx
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          {data && (
            <p className="text-sm text-gray-500 mt-0.5">
              {data.totalElements.toLocaleString()} transactions
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button onClick={resetFilters} className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Clear filters
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd spends/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd spends
git add frontend/src/api/export.ts
git add frontend/src/pages/TransactionPage.tsx
git commit -m "feat: add Export CSV button to Transactions page"
```

---

## Task 4: Frontend — Reports API + ReportsPage + Route + Nav

**Files:**
- Create: `spends/frontend/src/api/reports.ts`
- Create: `spends/frontend/src/pages/ReportsPage.tsx`
- Modify: `spends/frontend/src/App.tsx`
- Modify: `spends/frontend/src/components/Layout.tsx`

- [ ] **Step 1: Create reports.ts**

```typescript
// spends/frontend/src/api/reports.ts
import apiClient from './client'

export interface CategoryRow {
  category: string
  color: string | null
  amount: number
}

export interface MonthRow {
  yearMonth: string    // "2025-04"
  monthLabel: string   // "April 2025"
  totalSpent: number
  totalIncome: number
  net: number
  categories: CategoryRow[]
}

export interface YearSummary {
  year: number
  months: MonthRow[]
  grandTotalSpent: number
  grandTotalIncome: number
}

export async function getAvailableYears(): Promise<number[]> {
  const { data } = await apiClient.get<number[]>('/reports/available-years')
  return data
}

export async function getMonthlySummary(year: number): Promise<YearSummary> {
  const { data } = await apiClient.get<YearSummary>('/reports/monthly-summary', {
    params: { year },
  })
  return data
}
```

- [ ] **Step 2: Create ReportsPage.tsx**

```tsx
// spends/frontend/src/pages/ReportsPage.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Download, Printer, Loader2, TrendingDown, TrendingUp } from 'lucide-react'
import { getAvailableYears, getMonthlySummary, type MonthRow } from '../api/reports'
import { clsx } from 'clsx'

// ── Helpers ───────────────────────────────────────────────────────────────────

function inrFull(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Client-side CSV generation ────────────────────────────────────────────────

function generateCsv(months: MonthRow[], year: number): void {
  const rows = ['Month,Total Spent (INR),Total Income (INR),Net (INR),Top Category']
  for (const m of months) {
    const hasData = m.totalSpent > 0 || m.totalIncome > 0
    const topCat = [...m.categories].sort((a, b) => b.amount - a.amount)[0]?.category ?? ''
    rows.push([
      m.monthLabel,
      hasData ? m.totalSpent.toFixed(2) : '',
      hasData ? m.totalIncome.toFixed(2) : '',
      hasData ? m.net.toFixed(2) : '',
      topCat,
    ].join(','))
  }

  const csv = rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `monthly-report-${year}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Month row ─────────────────────────────────────────────────────────────────

function MonthRowComponent({ m }: { m: MonthRow }) {
  const net = m.net
  const hasData = m.totalSpent > 0 || m.totalIncome > 0
  const topCat = [...m.categories].sort((a, b) => b.amount - a.amount)[0]

  return (
    <tr className={clsx('border-b border-gray-100 hover:bg-gray-50', !hasData && 'opacity-40')}>
      <td className="px-4 py-3 font-medium text-gray-800 text-sm">{m.monthLabel}</td>
      <td className="px-4 py-3 text-right text-sm text-gray-900">
        {hasData ? inrFull(m.totalSpent) : '—'}
      </td>
      <td className="px-4 py-3 text-right text-sm text-gray-900">
        {hasData ? inrFull(m.totalIncome) : '—'}
      </td>
      <td className="px-4 py-3 text-right text-sm font-medium">
        {hasData ? (
          <span className={clsx('flex items-center justify-end gap-1', net >= 0 ? 'text-green-600' : 'text-red-600')}>
            {net >= 0
              ? <TrendingUp className="w-3 h-3 flex-shrink-0" />
              : <TrendingDown className="w-3 h-3 flex-shrink-0" />}
            {inrFull(Math.abs(net))}
          </span>
        ) : '—'}
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        {topCat && (
          <span className="flex items-center gap-1.5 text-xs text-gray-600">
            {topCat.color && (
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: topCat.color }} />
            )}
            {topCat.category}
          </span>
        )}
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { data: years = [] } = useQuery({
    queryKey: ['report-years'],
    queryFn: getAvailableYears,
    staleTime: 5 * 60_000,
  })

  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const year = selectedYear ?? (years.length > 0 ? years[0] : new Date().getFullYear())

  const { data: summary, isPending } = useQuery({
    queryKey: ['report-summary', year],
    queryFn: () => getMonthlySummary(year),
    enabled: years.length > 0,
    staleTime: 5 * 60_000,
  })

  const net = summary
    ? summary.grandTotalIncome - summary.grandTotalSpent
    : 0

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">

      {/* Screen header (hidden when printing) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Year selector */}
          {years.length > 0 && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={clsx(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                    year === y ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => summary && generateCsv(summary.months, year)}
            disabled={!summary}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-gray-900">SpendStack — Annual Report {year}</h1>
        <p className="text-sm text-gray-500 mt-1">Monthly income and spending summary</p>
      </div>

      {isPending && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {summary && (
        <>
          {/* Annual stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Annual Spent</p>
              <p className="text-lg font-bold text-gray-900">{inrFull(summary.grandTotalSpent)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Annual Income</p>
              <p className="text-lg font-bold text-gray-900">{inrFull(summary.grandTotalIncome)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Net {net >= 0 ? 'Savings' : 'Deficit'}</p>
              <p className={clsx('text-lg font-bold', net >= 0 ? 'text-green-600' : 'text-red-600')}>
                {inrFull(Math.abs(net))}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Avg Monthly Spend</p>
              <p className="text-lg font-bold text-gray-900">
                {inrFull(summary.grandTotalSpent / 12)}
              </p>
            </div>
          </div>

          {/* Monthly table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Month</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Spent</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Income</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Net</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Top Category</th>
                </tr>
              </thead>
              <tbody>
                {summary.months.map(m => (
                  <MonthRowComponent key={m.yearMonth} m={m} />
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-300">
                  <td className="px-4 py-3 text-sm font-bold text-gray-700">Total {year}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                    {inrFull(summary.grandTotalSpent)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                    {inrFull(summary.grandTotalIncome)}
                  </td>
                  <td className={clsx('px-4 py-3 text-right text-sm font-bold', net >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {inrFull(Math.abs(net))}
                  </td>
                  <td className="hidden sm:table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add route to App.tsx**

Open `spends/frontend/src/App.tsx`.

Add import at top:
```tsx
import ReportsPage from './pages/ReportsPage'
```

Inside the `<Route path="/" ...>` block, add after the `/recurring` route:
```tsx
          <Route path="reports" element={<ReportsPage />} />
```

- [ ] **Step 4: Add nav link to Layout.tsx**

Open `spends/frontend/src/components/Layout.tsx`.

**4a — Add `FileText` to the lucide-react import:**

Find the lucide-react import line and add `FileText`:
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
} from 'lucide-react'
```

**4b — Add Reports entry to the `nav` array** (add it after the Recurring entry, before Settings):

```tsx
  { to: '/reports',    label: 'Reports',    icon: FileText },
```

The full nav array should be:
```tsx
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
  { to: '/settings',     label: 'Settings',     icon: Settings },
]
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd spends/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 6: Start the dev server and verify the Reports page**

```bash
# Terminal 1: port-forward postgres
kubectl port-forward -n homelab svc/postgres 5432:5432

# Terminal 2: start the full stack
cd spends && ./dev-start.ps1
```

Manual test checklist:
- [ ] "Reports" appears in the sidebar nav with a document icon
- [ ] Clicking Reports loads the page with a year selector showing available years
- [ ] Selecting a different year reloads the table with that year's data
- [ ] Months with no data show `—` in all number columns at 40% opacity
- [ ] "Export CSV" downloads a file named `monthly-report-YYYY.csv` with 13 rows (header + 12 months)
- [ ] Opening the CSV in a spreadsheet shows Month, Total Spent, Total Income, Net, Top Category columns
- [ ] "Print" opens the browser print dialog; sidebar and buttons are hidden; only the report table prints
- [ ] On Transactions page: "Export CSV" button appears in the header
- [ ] Clicking Export CSV (with no filters) downloads `transactions-YYYY-MM-DD.csv`
- [ ] Clicking Export CSV with a category filter downloads only that category's transactions
- [ ] The downloaded transaction CSV has correct headers and properly escapes commas in remarks

- [ ] **Step 7: Commit**

```bash
cd spends
git add frontend/src/api/reports.ts
git add frontend/src/pages/ReportsPage.tsx
git add frontend/src/App.tsx
git add frontend/src/components/Layout.tsx
git commit -m "feat: add Reports page with monthly summary table, CSV export, and print support"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Transaction CSV export — Task 1 (backend) + Task 3 (frontend button)
- ✅ Monthly/yearly report — Task 2 (backend JSON) + Task 4 (ReportsPage)
- ✅ CSV download — Task 3 (transaction export) + Task 4 (client-side CSV from JSON)
- ✅ PDF / print — Task 4 (`window.print()` + `print:hidden` / `print:block` Tailwind classes)
- ✅ Year selector — Task 4 (`getAvailableYears` + year buttons)
- ✅ No new dependencies — confirmed: plain Java `StringBuilder` + native `fetch` + `Blob`

**Placeholder scan:** No TBDs found. All code blocks are complete.

**Type consistency check:**
- `ReportDto.MonthRow` fields used in `ReportService`: ✅ `yearMonth`, `monthLabel`, `totalSpent`, `totalIncome`, `net`, `categories`
- `ReportDto.CategoryRow` fields used in `ReportService`: ✅ `category`, `color`, `amount`
- `MonthRow` in `reports.ts` mirrors `ReportDto.MonthRow`: ✅ same field names
- `ExportService.escape(null)` tested: ✅ returns empty string
- `TransactionService.listAll` signature matches `ExportService.exportTransactionsCsv` call: ✅ same 7 params
- `downloadTransactionsCsv` in `export.ts` uses `useAuthStore.getState().token`: ✅ same pattern as `apiClient`'s interceptor
- `availableYears` query returns `List<Integer>` and `ReportService.getAvailableYears` returns `List<Integer>`: ✅
