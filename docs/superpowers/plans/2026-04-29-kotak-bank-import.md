# Kotak Mahindra Bank CSV Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Kotak Mahindra Bank as a third statement source in SpendStack's import pipeline, alongside ICICI (XLS) and Bank of Baroda (CSV).

**Architecture:** Mirror the BoB CSV import pattern: a new `@Component` parser returning the shared `ParsedStatement` record, a one-line addition to `ImportService`, a sibling `POST /api/import/kotak` endpoint, and a third option in the frontend bank dropdown. Multi-line descriptions in the Kotak CSV are merged into a single `rawRemarks` string. Account numbers are masked client-side at parse time using a 3-prefix + X-middle + 3-suffix scheme.

**Tech Stack:** Java 21, Spring Boot 3.3.4, Apache Commons CSV 1.11.0, Maven; React 18, TypeScript, Vite 5, TanStack Query v5; JUnit 5 + AssertJ + Spring Mock for tests.

**Spec:** [docs/superpowers/specs/2026-04-29-kotak-bank-import-design.md](../specs/2026-04-29-kotak-bank-import-design.md)

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `spend-stack/om-bank-statements/kotak/455XXXX349_03-01-2026_29-04-2026.csv` | EXISTS | Sample fixture for manual sanity-checks (already saved during brainstorming) |
| `backend/src/main/java/com/omprakashgautam/homelab/spends/service/KotakStatementParser.java` | Create | `@Component` that reads a Kotak CSV `MultipartFile` and returns `ParsedStatement` |
| `backend/src/test/java/com/omprakashgautam/homelab/spends/service/KotakStatementParserTest.java` | Create | JUnit 5 tests using inline CSV fixture strings |
| `backend/src/main/java/com/omprakashgautam/homelab/spends/service/ImportService.java` | Modify | Inject `KotakStatementParser`, add `importKotakFiles` method |
| `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/ImportController.java` | Modify | Add `POST /api/import/kotak` endpoint |
| `frontend/src/api/importStatements.ts` | Modify | Add `importKotakFiles(files)` function |
| `frontend/src/pages/ImportPage.tsx` | Modify | Add `KOTAK` option, refactor bank-conditional logic to map-based dispatch |
| `spends/CLAUDE.md` | Modify | Add `/api/import/kotak` row to API table; add Kotak feature entry |
| `~/.claude/projects/f--Development-home-lab/memory/project_roadmap.md` | Modify | Move Kotak from backlog to completed |

---

## Conventions

- Working directory throughout this plan is `f:/Development/home-lab/spends/` unless explicitly stated otherwise. The frontend lives at `f:/Development/home-lab/spends/frontend/`.
- Run backend tests from `f:/Development/home-lab/spends/backend/` with `mvn -pl . test -Dtest=<TestClassName>` for a single class, `mvn test` for the full suite.
- Run frontend type-check + build from `f:/Development/home-lab/spends/frontend/` with `npm run build`.
- All commits use HEREDOC commit messages with the existing project trailer:
  ```
  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```
- Strict TDD: each task that adds a behaviour writes the failing test first, runs it to confirm failure, implements the minimum to pass, runs to confirm pass, then commits.
- The very first parser task creates the stub class so subsequent test files compile. Subsequent parser tasks assume the stub exists and incrementally add behaviour to it.

---

## Task 1: Create `KotakStatementParser` stub + first test (account holder name)

**Files:**
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/KotakStatementParser.java`
- Create: `backend/src/test/java/com/omprakashgautam/homelab/spends/service/KotakStatementParserTest.java`

- [ ] **Step 1: Create the parser stub**

`backend/src/main/java/com/omprakashgautam/homelab/spends/service/KotakStatementParser.java`:

```java
package com.omprakashgautam.homelab.spends.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * Parses Kotak Mahindra Bank account statement CSV files exported from Net Banking.
 *
 * Column layout (0-indexed after Apache Commons CSV parsing):
 *   0  – #                  (sequence number; "-" for opening balance, blank for continuation row)
 *   1  – Date               (d MMM yyyy, e.g. "03 Jan 2026")
 *   2  – Description        (narration; may wrap across rows)
 *   3  – Chq/Ref. No.       (UPI ref, e.g. "UPI-600381736737")
 *   4  – Withdrawal (Dr.)
 *   5  – Deposit (Cr.)
 *   6  – Balance
 *
 * Multi-line wrap: a continuation row has blank col[0] and col[1], with a non-blank col[2].
 * The col[2] fragment is appended to the previous transaction's rawRemarks separated by a space.
 *
 * Page footer rows ("Statement Generated on ...") repeat per page and are skipped.
 * Account numbers are masked to "first 3 + X middle + last 3" before storage.
 */
@Slf4j
@Component
public class KotakStatementParser {

    public ParsedStatement parse(MultipartFile file) throws IOException {
        throw new UnsupportedOperationException("not implemented yet");
    }
}
```

- [ ] **Step 2: Create the test file with a single failing test**

`backend/src/test/java/com/omprakashgautam/homelab/spends/service/KotakStatementParserTest.java`:

```java
package com.omprakashgautam.homelab.spends.service;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class KotakStatementParserTest {

    private final KotakStatementParser parser = new KotakStatementParser();

    /** Inline fixture covering metadata, multi-line wrap, opening balance, and a page footer. */
    private static final String SAMPLE_CSV =
            "Account Statement,,,,,,\n" +
            "03 Jan 2026 - 29 Apr 2026,,,,,,\n" +
            "Omprakash Harishchandra Gautam,,,,Account No. 4550925349,,\n" +
            ",,,,Account Type Savings,,\n" +
            "MICR 411485055,IFSC Code KKBK0001819,,,,,\n" +
            ",,Savings Account Transactions,,,,\n" +
            "#,Date,Description,Chq/Ref. No.,Withdrawal (Dr.),Deposit (Cr.),Balance\n" +
            "-,-,Opening Balance,-,-,-,0\n" +
            "1,03 Jan 2026,KOTAK811/665749423572,,,50000,50000\n" +
            "2,03 Jan 2026,UPI/OMPRAKASH HARIS/600318766885/Early,UPI-600381736737,4000,,46000\n" +
            ",,Jan spend,,,,\n" +
            "\"Statement Generated on 29 Apr 2026, 03:21\",,,,,,Page 1 of 6\n" +
            "3,04 Jan 2026,REV-UPI/KAVITA,UPI-600422171528,,3000,49000\n" +
            "Account Summary,,,,,,\n" +
            "Particulars,Opening Balance,Closing Balance,,,,\n";

    @Test
    void parse_extractsAccountHolderName() throws Exception {
        MockMultipartFile file = csv("statement.csv", SAMPLE_CSV);
        ParsedStatement result = parser.parse(file);
        assertThat(result.accountHolderName()).isEqualTo("Omprakash Harishchandra Gautam");
    }

    private MockMultipartFile csv(String filename, String content) {
        return new MockMultipartFile("files", filename, "text/csv",
                content.getBytes(StandardCharsets.UTF_8));
    }
}
```

- [ ] **Step 3: Run the test and verify it fails**

```bash
cd f:/Development/home-lab/spends/backend
mvn -Dtest=KotakStatementParserTest test
```

Expected: 1 test, 1 failure — `UnsupportedOperationException: not implemented yet`. The test compiles (proves the stub class is wired correctly) and the assertion never runs.

- [ ] **Step 4: Implement metadata extraction**

Replace the body of `KotakStatementParser.java` entirely with:

```java
package com.omprakashgautam.homelab.spends.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

@Slf4j
@Component
public class KotakStatementParser {

    private static final int COL_SEQ         = 0;
    private static final int COL_DATE        = 1;
    private static final int COL_DESCRIPTION = 2;
    private static final int COL_CHEQ_REF    = 3;
    private static final int COL_WITHDRAWAL  = 4;
    private static final int COL_DEPOSIT     = 5;
    private static final int COL_BALANCE     = 6;

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

    public ParsedStatement parse(MultipartFile file) throws IOException {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            List<CSVRecord> records = CSVFormat.DEFAULT.parse(reader).getRecords();
            return parseRecords(records);
        }
    }

    private ParsedStatement parseRecords(List<CSVRecord> records) {
        String accountHolderName = null;
        String accountNumberMasked = null;
        int dataStartIdx = -1;

        for (int i = 0; i < records.size(); i++) {
            CSVRecord rec = records.get(i);
            String col0 = get(rec, 0).trim();
            String col1 = get(rec, 1).trim();
            String col4 = get(rec, 4).trim();

            // Holder name: row where col[4] starts with "Account No." → col[0] is the holder name.
            if (col4.startsWith("Account No.")) {
                accountHolderName = col0;
                String digits = col4.replaceAll("[^0-9]", "");
                accountNumberMasked = maskAccount(digits);
            }

            // Header row: col[0] == "#" AND col[1] == "Date"
            if ("#".equals(col0) && "Date".equalsIgnoreCase(col1)) {
                dataStartIdx = i + 1;
                break;
            }
        }

        if (dataStartIdx == -1) {
            throw new IllegalStateException(
                    "Could not find transaction header row in Kotak CSV");
        }

        log.info("Kotak parser: data starts at index {}, account={}, holder={}",
                dataStartIdx, accountNumberMasked, accountHolderName);

        return new ParsedStatement(
                "Kotak Mahindra Bank",
                accountNumberMasked,
                accountHolderName,
                "Savings",
                java.util.Collections.emptyList()
        );
    }

    private String get(CSVRecord rec, int col) {
        return col < rec.size() ? rec.get(col) : "";
    }

    /** "4550925349" → "455XXXX349"; preserves first 3 and last 3 digits. */
    private String maskAccount(String digits) {
        if (digits == null || digits.length() < 6) return digits;
        int xs = digits.length() - 6;
        return digits.substring(0, 3) + "X".repeat(xs) + digits.substring(digits.length() - 3);
    }
}
```

- [ ] **Step 5: Run the test and verify it passes**

```bash
cd f:/Development/home-lab/spends/backend
mvn -Dtest=KotakStatementParserTest test
```

Expected: 1 test, 0 failures. `parse_extractsAccountHolderName` is green.

- [ ] **Step 6: Commit**

```bash
cd f:/Development/home-lab/spends
git add backend/src/main/java/com/omprakashgautam/homelab/spends/service/KotakStatementParser.java \
        backend/src/test/java/com/omprakashgautam/homelab/spends/service/KotakStatementParserTest.java \
        spend-stack/om-bank-statements/kotak/455XXXX349_03-01-2026_29-04-2026.csv

git commit -m "$(cat <<'EOF'
feat(import): KotakStatementParser scaffold with metadata extraction

Adds a new @Component parser that reads Kotak Mahindra Bank CSV exports
and returns the shared ParsedStatement contract. This first commit
covers the metadata pass: holder name, account number (masked to
first-3 + X + last-3 form), and detection of the transaction header
row (#, Date, Description, ...). Transaction parsing follows in
subsequent commits.

Also commits the user-provided sample CSV to om-bank-statements/kotak/
for manual sanity checks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Account number masking + bank/account-type fields

**Files:**
- Modify: `backend/src/test/java/com/omprakashgautam/homelab/spends/service/KotakStatementParserTest.java`

These are simple assertions against state already populated by Task 1's metadata pass. Locking them in with explicit tests prevents future regression.

- [ ] **Step 1: Add three more failing tests**

Insert after `parse_extractsAccountHolderName`:

```java
    @Test
    void parse_masksAccountNumber() throws Exception {
        MockMultipartFile file = csv("statement.csv", SAMPLE_CSV);
        ParsedStatement result = parser.parse(file);
        assertThat(result.accountNumberMasked()).isEqualTo("455XXXX349");
    }

    @Test
    void parse_setsBankNameAndAccountType() throws Exception {
        MockMultipartFile file = csv("statement.csv", SAMPLE_CSV);
        ParsedStatement result = parser.parse(file);
        assertThat(result.bankName()).isEqualTo("Kotak Mahindra Bank");
        assertThat(result.accountType()).isEqualTo("Savings");
    }

    @Test
    void parse_throwsWhenNoHeaderRowFound() {
        String badCsv = "some,random,data\nno,header,here\n";
        MockMultipartFile file = csv("bad.csv", badCsv);
        assertThatThrownBy(() -> parser.parse(file))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Could not find transaction header row");
    }
```

- [ ] **Step 2: Run the tests and verify they pass**

```bash
cd f:/Development/home-lab/spends/backend
mvn -Dtest=KotakStatementParserTest test
```

Expected: 4 tests, 0 failures. All four assert against state already populated by Task 1's implementation — no parser change required. If any fails, fix the parser.

- [ ] **Step 3: Commit**

```bash
cd f:/Development/home-lab/spends
git add backend/src/test/java/com/omprakashgautam/homelab/spends/service/KotakStatementParserTest.java
git commit -m "$(cat <<'EOF'
test(import): cover Kotak parser masking, bank fields, missing header

Locks in three behaviours: account masking 4550925349 -> 455XXXX349,
bank name "Kotak Mahindra Bank" + account type "Savings", and
IllegalStateException when no transaction header row is present.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Single-row transaction parsing (withdrawal + deposit)

**Files:**
- Modify: `backend/src/test/java/com/omprakashgautam/homelab/spends/service/KotakStatementParserTest.java`
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/KotakStatementParser.java`

- [ ] **Step 1: Add two failing tests**

Insert after `parse_throwsWhenNoHeaderRowFound`:

```java
    @Test
    void parse_singleWithdrawalRow() throws Exception {
        MockMultipartFile file = csv("statement.csv", SAMPLE_CSV);
        ParsedStatement result = parser.parse(file);

        // Row "2" in fixture: 4000 withdrawal on 03 Jan 2026, balance 46000.
        // After multi-line merge (Task 4) rawRemarks will gain " Jan spend";
        // for now we assert the prefix.
        ParsedStatement.ParsedTransaction tx = result.transactions().stream()
                .filter(t -> t.withdrawalAmount().compareTo(new BigDecimal("4000")) == 0)
                .findFirst().orElseThrow();
        assertThat(tx.transactionDate()).isEqualTo(LocalDate.of(2026, 1, 3));
        assertThat(tx.valueDate()).isEqualTo(LocalDate.of(2026, 1, 3));
        assertThat(tx.depositAmount()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(tx.balance()).isEqualByComparingTo(new BigDecimal("46000"));
        assertThat(tx.chequeNumber()).isEqualTo("UPI-600381736737");
        assertThat(tx.rawRemarks()).startsWith("UPI/OMPRAKASH HARIS/600318766885/Early");
    }

    @Test
    void parse_singleDepositRow() throws Exception {
        MockMultipartFile file = csv("statement.csv", SAMPLE_CSV);
        ParsedStatement result = parser.parse(file);

        // Row "1" in fixture: 50000 deposit on 03 Jan 2026, balance 50000.
        ParsedStatement.ParsedTransaction tx = result.transactions().stream()
                .filter(t -> t.depositAmount().compareTo(new BigDecimal("50000")) == 0
                          && t.balance().compareTo(new BigDecimal("50000")) == 0)
                .findFirst().orElseThrow();
        assertThat(tx.transactionDate()).isEqualTo(LocalDate.of(2026, 1, 3));
        assertThat(tx.withdrawalAmount()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(tx.rawRemarks()).isEqualTo("KOTAK811/665749423572");
        assertThat(tx.chequeNumber()).isNull();
    }
```

- [ ] **Step 2: Run and verify both fail**

```bash
cd f:/Development/home-lab/spends/backend
mvn -Dtest=KotakStatementParserTest test
```

Expected: 6 tests run, 2 failures (`NoSuchElementException` because `transactions()` is currently `Collections.emptyList()`).

- [ ] **Step 3: Replace `parseRecords` with a transaction-parsing implementation**

Replace the existing `parseRecords` method, and add helper methods at the bottom of the class. The current method ends with `return new ParsedStatement(... emptyList())`; this version walks the rest of the records:

```java
    private ParsedStatement parseRecords(List<CSVRecord> records) {
        String accountHolderName = null;
        String accountNumberMasked = null;
        int dataStartIdx = -1;

        for (int i = 0; i < records.size(); i++) {
            CSVRecord rec = records.get(i);
            String col0 = get(rec, 0).trim();
            String col1 = get(rec, 1).trim();
            String col4 = get(rec, 4).trim();

            if (col4.startsWith("Account No.")) {
                accountHolderName = col0;
                String digits = col4.replaceAll("[^0-9]", "");
                accountNumberMasked = maskAccount(digits);
            }

            if ("#".equals(col0) && "Date".equalsIgnoreCase(col1)) {
                dataStartIdx = i + 1;
                break;
            }
        }

        if (dataStartIdx == -1) {
            throw new IllegalStateException(
                    "Could not find transaction header row in Kotak CSV");
        }

        log.info("Kotak parser: data starts at index {}, account={}, holder={}",
                dataStartIdx, accountNumberMasked, accountHolderName);

        List<ParsedStatement.ParsedTransaction> transactions = new java.util.ArrayList<>();

        for (int i = dataStartIdx; i < records.size(); i++) {
            CSVRecord rec = records.get(i);
            String col0 = get(rec, 0).trim();

            // Numeric seq → start of a new transaction row
            if (isNumeric(col0)) {
                try {
                    LocalDate date = LocalDate.parse(get(rec, COL_DATE).trim(), DATE_FMT);
                    String description = get(rec, COL_DESCRIPTION).trim();
                    String chequeRef   = get(rec, COL_CHEQ_REF).trim();
                    BigDecimal withdrawal = parseMoney(get(rec, COL_WITHDRAWAL));
                    BigDecimal deposit    = parseMoney(get(rec, COL_DEPOSIT));
                    BigDecimal balance    = parseMoney(get(rec, COL_BALANCE));

                    transactions.add(new ParsedStatement.ParsedTransaction(
                            date, date,
                            chequeRef.isBlank() ? null : chequeRef,
                            description,
                            withdrawal, deposit, balance
                    ));
                } catch (Exception e) {
                    log.warn("Kotak parser: skipping row {}: {}", i, e.getMessage());
                }
            }
            // Non-numeric col[0] (opening balance "-", page footers, account summary) → skipped for now;
            // multi-line continuation handling and termination logic added in subsequent tasks.
        }

        log.info("Kotak parser: parsed {} transactions", transactions.size());
        return new ParsedStatement(
                "Kotak Mahindra Bank",
                accountNumberMasked,
                accountHolderName,
                "Savings",
                transactions
        );
    }
```

Add these required imports at the top of the file (alongside the existing imports):

```java
import java.math.BigDecimal;
import java.util.ArrayList;
```

Add these helpers at the bottom of the class (just before the closing brace), after the existing `maskAccount` helper:

```java
    private boolean isNumeric(String s) {
        if (s == null || s.isEmpty()) return false;
        for (int i = 0; i < s.length(); i++) {
            if (!Character.isDigit(s.charAt(i))) return false;
        }
        return true;
    }

    private BigDecimal parseMoney(String text) {
        if (text == null || text.isBlank()) return BigDecimal.ZERO;
        String clean = text.trim().replace(",", "");
        if (clean.isBlank()) return BigDecimal.ZERO;
        try { return new BigDecimal(clean); }
        catch (NumberFormatException e) { return BigDecimal.ZERO; }
    }
```

(Remove the `import java.util.Collections;` import if it was added previously — it's no longer needed.)

- [ ] **Step 4: Run the parser tests**

```bash
cd f:/Development/home-lab/spends/backend
mvn -Dtest=KotakStatementParserTest test
```

Expected: 6 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
cd f:/Development/home-lab/spends
git add backend/src/main/java/com/omprakashgautam/homelab/spends/service/KotakStatementParser.java \
        backend/src/test/java/com/omprakashgautam/homelab/spends/service/KotakStatementParserTest.java
git commit -m "$(cat <<'EOF'
feat(import): parse Kotak CSV transaction rows

Walks records after the header row, treats any row whose col[0] is a
numeric integer string as a new transaction, parses date (d MMM yyyy
English locale), description, Chq/Ref, withdrawal, deposit, and
balance. Non-numeric col[0] rows (opening balance dash, page footers)
are skipped silently for now; multi-line wrap and explicit
end-of-statement termination are added in follow-up commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Multi-line description merging

**Files:**
- Modify: `backend/src/test/java/com/omprakashgautam/homelab/spends/service/KotakStatementParserTest.java`
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/KotakStatementParser.java`

- [ ] **Step 1: Add the failing continuation-row test**

Insert after `parse_singleDepositRow`:

```java
    @Test
    void parse_mergesContinuationRow() throws Exception {
        MockMultipartFile file = csv("statement.csv", SAMPLE_CSV);
        ParsedStatement result = parser.parse(file);

        // Row "2" + continuation row -> "UPI/OMPRAKASH HARIS/600318766885/Early Jan spend"
        ParsedStatement.ParsedTransaction tx = result.transactions().stream()
                .filter(t -> t.withdrawalAmount().compareTo(new BigDecimal("4000")) == 0)
                .findFirst().orElseThrow();
        assertThat(tx.rawRemarks())
                .isEqualTo("UPI/OMPRAKASH HARIS/600318766885/Early Jan spend");
    }
```

- [ ] **Step 2: Run and verify it fails**

```bash
cd f:/Development/home-lab/spends/backend
mvn -Dtest=KotakStatementParserTest test
```

Expected: 7 tests, 1 failure — `rawRemarks` is `"UPI/OMPRAKASH HARIS/600318766885/Early"` (no continuation merged yet).

- [ ] **Step 3: Add continuation-row handling**

In `KotakStatementParser.parseRecords`, replace the transaction loop body so that an `else if (isContinuationRow(rec) && !transactions.isEmpty())` branch appends the continuation fragment to the previous transaction's `rawRemarks`. Because `ParsedTransaction` is a record (immutable), the loop must replace the last entry in the list with a copy whose `rawRemarks` is updated.

The full updated transaction loop:

```java
        for (int i = dataStartIdx; i < records.size(); i++) {
            CSVRecord rec = records.get(i);
            String col0 = get(rec, 0).trim();

            if (isNumeric(col0)) {
                try {
                    LocalDate date = LocalDate.parse(get(rec, COL_DATE).trim(), DATE_FMT);
                    String description = get(rec, COL_DESCRIPTION).trim();
                    String chequeRef   = get(rec, COL_CHEQ_REF).trim();
                    BigDecimal withdrawal = parseMoney(get(rec, COL_WITHDRAWAL));
                    BigDecimal deposit    = parseMoney(get(rec, COL_DEPOSIT));
                    BigDecimal balance    = parseMoney(get(rec, COL_BALANCE));

                    transactions.add(new ParsedStatement.ParsedTransaction(
                            date, date,
                            chequeRef.isBlank() ? null : chequeRef,
                            description,
                            withdrawal, deposit, balance
                    ));
                } catch (Exception e) {
                    log.warn("Kotak parser: skipping row {}: {}", i, e.getMessage());
                }
            } else if (isContinuationRow(rec) && !transactions.isEmpty()) {
                ParsedStatement.ParsedTransaction last = transactions.get(transactions.size() - 1);
                String fragment = get(rec, COL_DESCRIPTION).trim();
                String merged = last.rawRemarks() + " " + fragment;
                transactions.set(transactions.size() - 1, new ParsedStatement.ParsedTransaction(
                        last.valueDate(), last.transactionDate(),
                        last.chequeNumber(), merged,
                        last.withdrawalAmount(), last.depositAmount(), last.balance()
                ));
            }
        }
```

Add the helper at the bottom of the class:

```java
    /** Continuation row: blank seq AND blank date AND non-blank description. */
    private boolean isContinuationRow(CSVRecord rec) {
        return get(rec, COL_SEQ).trim().isEmpty()
            && get(rec, COL_DATE).trim().isEmpty()
            && !get(rec, COL_DESCRIPTION).trim().isEmpty();
    }
```

- [ ] **Step 4: Run the parser tests**

```bash
cd f:/Development/home-lab/spends/backend
mvn -Dtest=KotakStatementParserTest test
```

Expected: 7 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
cd f:/Development/home-lab/spends
git add backend/src/main/java/com/omprakashgautam/homelab/spends/service/KotakStatementParser.java \
        backend/src/test/java/com/omprakashgautam/homelab/spends/service/KotakStatementParserTest.java
git commit -m "$(cat <<'EOF'
feat(import): merge multi-line Kotak descriptions into rawRemarks

A Kotak CSV row whose col[0] (seq) and col[1] (date) are both blank
but col[2] (description) is populated is a wrap-around fragment from
the previous transaction. Merge by appending " <fragment>" to the
last transaction's rawRemarks so categorisation regex matches across
the whole UPI string.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Skip opening balance and page footers; lock in transaction count

**Files:**
- Modify: `backend/src/test/java/com/omprakashgautam/homelab/spends/service/KotakStatementParserTest.java`

The current implementation already skips the opening-balance row (col[0]="-", non-numeric) and the page-footer row (col[0] starts with `"Statement Generated on"`, non-numeric). It also skips `Account Summary`, `Particulars`, and other trailing-boilerplate rows because none have numeric col[0]. This task locks those skips in place with assertions.

- [ ] **Step 1: Add three failing tests**

Insert after `parse_mergesContinuationRow`:

```java
    @Test
    void parse_skipsOpeningBalance() throws Exception {
        MockMultipartFile file = csv("statement.csv", SAMPLE_CSV);
        ParsedStatement result = parser.parse(file);

        // Opening balance row has col[0]="-", balance 0 - it must NOT appear as a transaction.
        boolean hasZeroBalanceRow = result.transactions().stream()
                .anyMatch(t -> t.balance().compareTo(BigDecimal.ZERO) == 0
                            && t.rawRemarks().equalsIgnoreCase("Opening Balance"));
        assertThat(hasZeroBalanceRow).isFalse();
    }

    @Test
    void parse_skipsPageFooter() throws Exception {
        MockMultipartFile file = csv("statement.csv", SAMPLE_CSV);
        ParsedStatement result = parser.parse(file);

        // The page footer "Statement Generated on..." must not produce a transaction.
        boolean hasFooterTx = result.transactions().stream()
                .anyMatch(t -> t.rawRemarks() != null
                            && t.rawRemarks().contains("Statement Generated on"));
        assertThat(hasFooterTx).isFalse();
    }

    @Test
    void parse_yieldsExactlyThreeTransactionsFromFixture() throws Exception {
        MockMultipartFile file = csv("statement.csv", SAMPLE_CSV);
        ParsedStatement result = parser.parse(file);

        // Fixture has rows numbered 1, 2, 3 (deposit / withdrawal / reversal-credit).
        // Opening balance, page footer, Account Summary boilerplate, and continuation
        // rows must NOT be counted as transactions.
        assertThat(result.transactions()).hasSize(3);
    }
```

- [ ] **Step 2: Run the tests and verify they pass**

```bash
cd f:/Development/home-lab/spends/backend
mvn -Dtest=KotakStatementParserTest test
```

Expected: 10 tests, 0 failures. All three assertions pass against the existing implementation. If `parse_yieldsExactlyThreeTransactionsFromFixture` fails (e.g., counts 4), the implementation is incorrectly emitting one of the boilerplate rows — fix by inspecting the loop body.

- [ ] **Step 3: Commit**

```bash
cd f:/Development/home-lab/spends
git add backend/src/test/java/com/omprakashgautam/homelab/spends/service/KotakStatementParserTest.java
git commit -m "$(cat <<'EOF'
test(import): lock in Kotak parser skip behaviour for non-tx rows

Asserts that opening balance ("-" seq), page footers ("Statement
Generated on..."), and Account Summary boilerplate rows never appear
as transactions, and that the inline fixture yields exactly the 3
expected transaction rows.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire `KotakStatementParser` into `ImportService` and `ImportController`

**Files:**
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/ImportService.java`
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/ImportController.java`

- [ ] **Step 1: Inject the parser and add `importKotakFiles`**

In `backend/src/main/java/com/omprakashgautam/homelab/spends/service/ImportService.java`, after the existing line:

```java
    private final BobStatementParser bobParser;
```

add:

```java
    private final KotakStatementParser kotakParser;
```

After the existing `importBobFiles` method:

```java
    @Transactional
    public ImportResultDto.Response importBobFiles(UUID userId, List<MultipartFile> files) {
        return importFilesWith(userId, files, bobParser::parse);
    }
```

add:

```java
    @Transactional
    public ImportResultDto.Response importKotakFiles(UUID userId, List<MultipartFile> files) {
        return importFilesWith(userId, files, kotakParser::parse);
    }
```

- [ ] **Step 2: Add the controller endpoint**

In `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/ImportController.java`, after the existing `/bob` mapping (which ends at line 52):

```java
    /** Upload one or more Bank of Baroda account statement CSV files. */
    @PostMapping(value = "/bob", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportResultDto.Response> importBob(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestPart("files") List<MultipartFile> files) {

        if (files == null || files.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(importService.importBobFiles(principal.getId(), files));
    }
```

add:

```java
    /** Upload one or more Kotak Mahindra Bank account statement CSV files. */
    @PostMapping(value = "/kotak", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportResultDto.Response> importKotak(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestPart("files") List<MultipartFile> files) {

        if (files == null || files.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(importService.importKotakFiles(principal.getId(), files));
    }
```

- [ ] **Step 3: Run the full backend test suite**

```bash
cd f:/Development/home-lab/spends/backend
mvn test
```

Expected: full suite passes (existing tests already cover ICICI/BoB routing in `ImportServiceTest`; Kotak routing follows the same `importFilesWith` mechanism, no new integration test needed). If the Spring context fails to start, the most likely cause is a typo in the field name `kotakParser` — `@RequiredArgsConstructor` infers the constructor argument by field name and Spring autowires by type, but a missing `@Component` on the parser would surface as `NoSuchBeanDefinitionException`.

- [ ] **Step 4: Commit**

```bash
cd f:/Development/home-lab/spends
git add backend/src/main/java/com/omprakashgautam/homelab/spends/service/ImportService.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/controller/ImportController.java
git commit -m "$(cat <<'EOF'
feat(import): wire Kotak parser into ImportService + add /kotak endpoint

Inject KotakStatementParser into ImportService and add
importKotakFiles delegating to the shared importFilesWith helper.
Expose POST /api/import/kotak in ImportController matching the /icici
and /bob endpoints (multipart, files[], 400 on empty list).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Frontend API client — `importKotakFiles`

**Files:**
- Modify: `frontend/src/api/importStatements.ts`

- [ ] **Step 1: Add the third bank-import function**

In `frontend/src/api/importStatements.ts`, after the existing `importBobFiles` function (which ends at line 53):

```typescript
export async function importBobFiles(files: File[]): Promise<ImportResult> {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  const { data } = await apiClient.post<ImportResult>('/import/bob', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
```

add:

```typescript
export async function importKotakFiles(files: File[]): Promise<ImportResult> {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  const { data } = await apiClient.post<ImportResult>('/import/kotak', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
```

- [ ] **Step 2: Type-check the frontend**

```bash
cd f:/Development/home-lab/spends/frontend
npm run build
```

Expected: build succeeds with no TypeScript errors. The new function is unused for now (it is consumed in Task 8) — that's fine because exports do not need callers.

- [ ] **Step 3: Commit**

```bash
cd f:/Development/home-lab/spends
git add frontend/src/api/importStatements.ts
git commit -m "$(cat <<'EOF'
feat(frontend): add importKotakFiles API client

Mirrors importIciciFiles / importBobFiles - posts a multipart form to
POST /api/import/kotak and returns the standard ImportResult.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Frontend UI — add Kotak option (refactor inline ternaries to maps)

**Files:**
- Modify: `frontend/src/pages/ImportPage.tsx`

The existing `ImportPage.tsx` uses `selectedBank === 'BOB' ? ... : ...` ternaries scattered across at least seven sites. Adding a third bank with nested ternaries would be unreadable. Refactor to map-based dispatch (a per-bank config object) and add the Kotak entry.

- [ ] **Step 1: Update the import statement**

At [frontend/src/pages/ImportPage.tsx:5-6](../frontend/src/pages/ImportPage.tsx) (the imports from `../api/importStatements`), add `importKotakFiles`:

```typescript
import {
  importIciciFiles,
  importBobFiles,
  importKotakFiles,
  // ... rest of existing imports stay the same
```

- [ ] **Step 2: Replace the inline `selectedBank` state and add a per-bank config map**

Find the existing useState (`frontend/src/pages/ImportPage.tsx:33`):

```typescript
const [selectedBank, setSelectedBank] = useState<'ICICI' | 'BOB'>('ICICI')
```

Replace with:

```typescript
type Bank = 'ICICI' | 'BOB' | 'KOTAK'

const BANK_CONFIG: Record<Bank, {
  label: string
  accept: string
  shortLabel: string         // "XLS or XLSX" / "CSV"
  exportLabel: string        // "ICICI Bank XLS/XLSX exports" / "Bank of Baroda CSV exports"
  description: string        // sentence under the page heading
  errorMessage: string       // shown on import failure
  isAccepted: (file: File) => boolean
  importFn: (files: File[]) => Promise<ImportResult>
}> = {
  ICICI: {
    label: 'ICICI Bank',
    accept: '.xls,.xlsx',
    shortLabel: 'XLS or XLSX',
    exportLabel: 'ICICI Bank XLS/XLSX exports',
    description: 'Upload ICICI bank statement XLS/XLSX files. Duplicates are automatically skipped.',
    errorMessage: 'Import failed. Please check that the files are valid ICICI XLS statements.',
    isAccepted: (f) => f.name.endsWith('.xls') || f.name.endsWith('.xlsx'),
    importFn: importIciciFiles,
  },
  BOB: {
    label: 'Bank of Baroda',
    accept: '.csv',
    shortLabel: 'CSV',
    exportLabel: 'Bank of Baroda CSV exports',
    description: 'Upload Bank of Baroda account statement CSV files. Duplicates are automatically skipped.',
    errorMessage: 'Import failed. Please check that the files are valid Bank of Baroda CSV statements.',
    isAccepted: (f) => f.name.endsWith('.csv'),
    importFn: importBobFiles,
  },
  KOTAK: {
    label: 'Kotak Mahindra Bank',
    accept: '.csv',
    shortLabel: 'CSV',
    exportLabel: 'Kotak Mahindra Bank CSV exports',
    description: 'Upload Kotak Mahindra Bank Net Banking CSV files. Duplicates are automatically skipped.',
    errorMessage: 'Import failed. Please check that the files are valid Kotak Mahindra Bank CSV statements.',
    isAccepted: (f) => f.name.endsWith('.csv'),
    importFn: importKotakFiles,
  },
}

const [selectedBank, setSelectedBank] = useState<Bank>('ICICI')
const bankConfig = BANK_CONFIG[selectedBank]
```

`ImportResult` is already exported from `../api/importStatements` (the existing file imports it implicitly via the `setResult` setter type). If TypeScript complains that `ImportResult` is undefined here, add it to the import block in Step 1: `import { ..., ImportResult } from '../api/importStatements'`.

- [ ] **Step 3: Replace the seven inline ternaries with `bankConfig` lookups**

Each replacement targets the existing line in `ImportPage.tsx`. Use Edit to replace exactly:

**3a.** The `useMutation` `mutationFn` (currently around line 54 — `selectedBank === 'ICICI' ? importIciciFiles(files) : importBobFiles(files)`):

Change to:

```typescript
mutationFn: (files: File[]) => bankConfig.importFn(files),
```

(If the existing form uses an arrow body, retain the arrow form: `mutationFn: (files: File[]) => bankConfig.importFn(files)`.)

**3b.** The `addFiles` accept filter (currently around line 108):

Replace:

```typescript
const accepted = incoming.filter((f) => {
  if (selectedBank === 'BOB') return f.name.endsWith('.csv')
  return f.name.endsWith('.xls') || f.name.endsWith('.xlsx')
})
```

With:

```typescript
const accepted = incoming.filter(bankConfig.isAccepted)
```

The `useCallback` dependency array `[selectedBank]` stays — `bankConfig` is derived from `selectedBank` and is referenced inside the callback, so `selectedBank` is the correct dependency.

**3c.** The page-heading description (currently around lines 148-150):

Replace:

```tsx
{selectedBank === 'ICICI'
  ? 'Upload ICICI bank statement XLS/XLSX files. Duplicates are automatically skipped.'
  : 'Upload Bank of Baroda account statement CSV files. Duplicates are automatically skipped.'}
```

With:

```tsx
{bankConfig.description}
```

**3d.** The bank-selector `onChange` cast (currently around line 162):

Replace:

```typescript
setSelectedBank(e.target.value as 'ICICI' | 'BOB')
```

With:

```typescript
setSelectedBank(e.target.value as Bank)
```

**3e.** Add the Kotak `<option>` (currently around lines 168-169):

Replace:

```tsx
<option value="ICICI">ICICI Bank</option>
<option value="BOB">Bank of Baroda</option>
```

With:

```tsx
<option value="ICICI">ICICI Bank</option>
<option value="BOB">Bank of Baroda</option>
<option value="KOTAK">Kotak Mahindra Bank</option>
```

**3f.** The drop-zone `accept` attribute (currently around line 189):

Replace:

```tsx
accept={selectedBank === 'BOB' ? '.csv' : '.xls,.xlsx'}
```

With:

```tsx
accept={bankConfig.accept}
```

**3g.** The drop-zone hint text (currently around line 195):

Replace:

```tsx
<p className="text-gray-700 dark:text-gray-200 font-medium">Drop {selectedBank === 'BOB' ? 'CSV' : 'XLS or XLSX'} files here</p>
```

With:

```tsx
<p className="text-gray-700 dark:text-gray-200 font-medium">Drop {bankConfig.shortLabel} files here</p>
```

**3h.** The drop-zone footer text (currently around line 198):

Replace:

```tsx
{selectedBank === 'BOB' ? 'Bank of Baroda CSV exports' : 'ICICI Bank XLS/XLSX exports'} · Multiple files at once
```

With:

```tsx
{bankConfig.exportLabel} · Multiple files at once
```

**3i.** The error banner text (currently around lines 241-243):

Replace:

```tsx
{selectedBank === 'ICICI'
  ? 'Import failed. Please check that the files are valid ICICI XLS statements.'
  : 'Import failed. Please check that the files are valid Bank of Baroda CSV statements.'}
```

With:

```tsx
{bankConfig.errorMessage}
```

- [ ] **Step 4: Type-check + build**

```bash
cd f:/Development/home-lab/spends/frontend
npm run build
```

Expected: build succeeds. If TypeScript flags `ImportResult` as missing (Step 2 caveat), add it to the import in Step 1.

- [ ] **Step 5: Commit**

```bash
cd f:/Development/home-lab/spends
git add frontend/src/pages/ImportPage.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): add Kotak Mahindra Bank to import dropdown

Refactors per-bank conditionals from scattered inline ternaries to a
single BANK_CONFIG map keyed by 'ICICI' | 'BOB' | 'KOTAK'. Each entry
holds the dropdown label, accept attribute, drop-zone hint, error
message, file filter, and import function. Adding KOTAK is one map
entry plus the <option> tag.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: End-to-end smoke test on dev server

**Files:** none modified — verification only.

- [ ] **Step 1: Start the dev environment**

```powershell
cd f:/Development/home-lab/spends
.\dev-start.ps1
```

The script port-forwards Postgres, starts the backend (`http://localhost:8080`), starts the frontend (`http://localhost:5173`), waits for health checks, and opens the browser. If any step fails, address the underlying error before proceeding (do **not** proceed with smoke test if the backend doesn't start).

- [ ] **Step 2: Log in and navigate to Import**

In the browser:
1. Log in with the existing admin user.
2. Navigate to **Manage → Import** in the sidebar.
3. Verify the **Bank** dropdown lists three options: ICICI Bank, Bank of Baroda, Kotak Mahindra Bank.

- [ ] **Step 3: Import the sample Kotak file**

1. Select **Kotak Mahindra Bank** from the dropdown.
2. Drag-and-drop `f:/Development/home-lab/spend-stack/om-bank-statements/kotak/455XXXX349_03-01-2026_29-04-2026.csv` onto the drop zone (or click and browse).
3. Click **Import**.

Expected import summary: **107 imported**, 0 duplicates, 0 errors. The categorization confidence badge should be green or yellow (≥ 50%).

- [ ] **Step 4: Verify duplicate detection on second import**

Click **Import** again with the same file selected. Expected: **0 imported, 107 duplicates**.

- [ ] **Step 5: Verify the data lands correctly**

Navigate to **Spend → Transactions** and confirm:
- New rows appear with `bankName=Kotak Mahindra Bank` and `accountNumberMasked=455XXXX349` in the bank-context badge under each row.
- Date format is correct (e.g. `03 Jan 2026`).
- Multi-line descriptions are merged: find the row for `4000` withdrawal on 03 Jan 2026 — its description should read `UPI/OMPRAKASH HARIS/600318766885/Early Jan spend`.

- [ ] **Step 6: Verify dashboard + bank-account filter**

Navigate to **Spend → Dashboard**. The bank-account selector at the top right should now offer the new Kotak account (since the user now has > 1 account). Select it and verify the totals reflect only Kotak transactions.

- [ ] **Step 7: Stop the dev environment**

```powershell
cd f:/Development/home-lab/spends
.\dev-start.ps1 -Stop
```

- [ ] **Step 8: No commit** — this is a verification task only. If any check fails, return to the relevant earlier task and fix the underlying code before continuing.

---

## Task 10: Documentation update

**Files:**
- Modify: `spends/CLAUDE.md`
- Modify: `~/.claude/projects/f--Development-home-lab/memory/project_roadmap.md`

- [ ] **Step 1: Add `/api/import/kotak` to the API table in CLAUDE.md**

In `spends/CLAUDE.md`, find the existing row:

```markdown
| POST | `/api/import/bob` | JWT | Import Bank of Baroda CSV files (multipart, field: `files`) |
```

Insert immediately after it:

```markdown
| POST | `/api/import/kotak` | JWT | Import Kotak Mahindra Bank CSV files (multipart, field: `files`) |
```

- [ ] **Step 2: Append a new feature entry to CLAUDE.md**

At the end of `spends/CLAUDE.md` (after the existing "Feature — Bank Account Context" entry), append:

```markdown
### Feature — Kotak Mahindra Bank CSV Import ✅ COMPLETE
Third bank statement source after ICICI (XLS) and BoB (CSV). Mirrors the BoB pattern.

- **`KotakStatementParser`** (NEW) — `@Component` CSV parser using Apache Commons CSV; reads Kotak Net Banking exports with date format `d MMM yyyy` (English locale); content-detected metadata (holder name + masked account number) via row where col[4] starts with `Account No.`; data start = row after `#, Date, ...` header
- **Multi-line wrap** — continuation rows (blank seq + blank date + populated description) are merged into the previous transaction's `rawRemarks` separated by a single space so categorization rules match across the full UPI string
- **Account masking** — full account number from CSV (e.g. `4550925349`) is masked to first-3 + X middle + last-3 (e.g. `455XXXX349`) for consistency with BoB display style
- **Skip patterns** — opening balance row (col[0]=`-`), repeating page footers (`Statement Generated on …`), and trailing Account Summary boilerplate are all silently skipped (non-numeric col[0])
- **`ImportService.importKotakFiles`** — one-line delegation to the shared `importFilesWith` helper
- **`POST /api/import/kotak`** — sibling to `/icici` and `/bob` endpoints in `ImportController`
- **Frontend** — `BANK_CONFIG` map in `ImportPage.tsx` replaces scattered inline ternaries; adding Kotak is one map entry plus the `<option>` tag; `importKotakFiles` in `api/importStatements.ts`
- **Tests** — 10 `KotakStatementParserTest` tests (metadata, masking, single withdrawal/deposit, multi-line merge, opening balance skip, page footer skip, exact transaction count, missing-header throws); existing `ImportServiceTest` unmodified — Kotak routing is identical to BoB and exercising it again is redundant
- **Sample fixture** — real export saved at `spend-stack/om-bank-statements/kotak/455XXXX349_03-01-2026_29-04-2026.csv` for manual sanity checks
```

- [ ] **Step 3: Update the memory roadmap**

Find `~/.claude/projects/f--Development-home-lab/memory/project_roadmap.md`. The current backlog line probably reads:

> Backlog: more bank parsers (HDFC/SBI/Axis), …

Replace with:

> Backlog: more bank parsers (HDFC/SBI/Axis); Kotak ✅ done 2026-04-29.

If the existing wording differs, preserve the rest of the roadmap and just update the bank-parser bullet to remove Kotak from the backlog and note completion. Do **not** create a new memory file — update in place per the auto-memory guidance.

- [ ] **Step 4: Commit**

```bash
cd f:/Development/home-lab/spends
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: document Kotak Mahindra Bank CSV import feature

Adds /api/import/kotak to the API table and a feature entry covering
the parser quirks (multi-line wrap, masking, page-footer skip), the
frontend BANK_CONFIG refactor, and the test coverage.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(The memory file lives outside the repo and is committed via the auto-memory mechanism, not git.)

---

## Acceptance — Verification Checklist

Once all tasks are complete:

- [ ] `cd backend && mvn test` reports **all tests green** (existing test count + 10 new `KotakStatementParserTest` tests).
- [ ] `cd frontend && npm run build` succeeds with **no TypeScript errors**.
- [ ] Selecting Kotak Mahindra Bank from the Import page dropdown and uploading `spend-stack/om-bank-statements/kotak/455XXXX349_03-01-2026_29-04-2026.csv` results in **107 imported, 0 duplicates, 0 errors** on first run.
- [ ] Re-uploading the same file results in **0 imported, 107 duplicates**.
- [ ] Transactions list shows new Kotak rows with `bankName=Kotak Mahindra Bank`, `accountNumberMasked=455XXXX349`, correctly merged multi-line descriptions, and proper categorization (≥ 50% non-Miscellaneous).
- [ ] Dashboard bank-account filter offers the new Kotak account.
- [ ] `spends/CLAUDE.md` reflects the new endpoint and feature entry.
- [ ] Memory roadmap reflects Kotak as completed.

---

## Risk Log

| Risk | Surface point | Mitigation |
|---|---|---|
| Apache Commons CSV does not handle Kotak's quoted page footer line cleanly | Task 5 — `parse_skipsPageFooter` test would catch | The fixture in Task 1 already includes the quoted footer; if the test fails the implementation can be adjusted |
| `@RequiredArgsConstructor` constructor ordering breaks when adding `KotakStatementParser` to `ImportService` | Task 6 Step 3 — Spring context startup | Lombok generates the constructor in field-declaration order, all parsers are autowired by type — no semantic dependency |
| `ImportPage.tsx` map-based refactor accidentally regresses ICICI or BoB behaviour | Task 9 — smoke test | Run smoke test with all three banks (the smoke test only exercises Kotak, but a quick manual ICICI upload after the smoke test gives full confidence) |
| Multi-line continuation appears with `>2` rows in real Kotak exports beyond the sample | Production data | The continuation logic appends to "the previous transaction" repeatedly — N continuation rows would all merge correctly. No code change needed, but flag if observed |
| Non-Latin description characters break date parsing or money parsing | Production data | `LocalDate.parse` uses `Locale.ENGLISH` for month names; description text is treated as opaque string. No risk |
