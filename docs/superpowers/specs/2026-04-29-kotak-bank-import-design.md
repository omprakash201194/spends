# Kotak Bank CSV Import — Design

**Date:** 2026-04-29
**Status:** Approved
**Pattern:** Mirrors Bank of Baroda CSV import (Phase — "Bank of Baroda CSV Import" complete)

---

## Goal

Add Kotak Mahindra Bank as a third statement source in SpendStack, alongside ICICI (XLS) and Bank of Baroda (CSV). Users select Kotak from the bank dropdown on the Import page, upload one or more CSV exports from Kotak Net Banking, and the system parses, deduplicates, auto-categorizes, and persists transactions exactly as for the existing banks.

---

## Non-Goals

- No changes to the `ParsedStatement` contract, `Transaction` entity, deduplication hash, categorization pipeline, or `BankAccount` schema.
- No changes to ICICI or BoB parsers.
- No PDF parsing — Kotak CSV exports only.
- No support for credit-card or NRI account statement variants.

---

## Source Format Reference

Sample file: `spend-stack/om-bank-statements/kotak/455XXXX349_03-01-2026_29-04-2026.csv` (account-masked filename, derived from user-provided sample).

### Header section (rows 0 — ~14, content-detected, not fixed-row)

```
Account Statement,,,,,,
03 Jan 2026 - 29 Apr 2026,,,,,,
Omprakash Harishchandra Gautam,,,,Account No. 4550925349,,
,,,,Account Type Savings,,
CRN xxxxxx063,,,,,,
,,,,Branch Pune-Hinjevadi-Phase I,,
...
,,Savings Account Transactions,,,,
#,Date,Description,Chq/Ref. No.,Withdrawal (Dr.),Deposit (Cr.),Balance
-,-,Opening Balance,-,-,-,0
```

Detection signals:
- Holder name: row where col[4] starts with `Account No.` → col[0] is the holder name.
- Account number: same row, digits trailing `Account No.` in col[4].
- Header row: col[0] == `#` AND col[1] == `Date` → data starts at next row.

### Transaction columns (after header)

| Col | Field | Notes |
|---|---|---|
| 0 | `#` | Sequence number — numeric for transactions, `-` for opening balance |
| 1 | Date | Format: `d MMM yyyy` (e.g. `03 Jan 2026`) |
| 2 | Description | Narration; **may wrap** onto next row |
| 3 | Chq/Ref. No. | UPI reference (e.g. `UPI-600381736737`) — stored as `chequeNumber` |
| 4 | Withdrawal (Dr.) | Numeric, blank if deposit |
| 5 | Deposit (Cr.) | Numeric, blank if withdrawal |
| 6 | Balance | Always positive (savings) — no Dr/Cr suffix |

### Multi-line description wrap

Long descriptions wrap onto a continuation row that has empty col[0] (`#`), empty col[1] (Date), and a populated col[2] (Description fragment) with all other columns blank.

```
4,03 Jan 2026,UPI/OMPRAKASH HARIS/600318766885/Early,UPI-600381736737,4000,,46000
,,Jan spend,,,,
```

Continuation rows are merged into the previous transaction's `rawRemarks` separated by a single space.

### Page footers and end-of-statement

Repeating page footer (every page in a multi-page export):
```
"Statement Generated on 29 Apr 2026, 03:21",,,,,,Page 1 of 6
```

After the last transaction row the file contains "Account Summary", boilerplate, and contact info — these must be skipped/terminate parsing cleanly.

---

## Architecture

```
ImportPage (frontend)
    │  selectedBank: 'ICICI' | 'BOB' | 'KOTAK'
    ▼
POST /api/import/kotak  (multipart, files[])
    │
    ▼
ImportController.importKotak
    │
    ▼
ImportService.importKotakFiles
    │  delegates to importFilesWith(userId, files, kotakParser::parse)
    ▼
KotakStatementParser  (new @Component)
    │  returns ParsedStatement
    ▼
[shared] BankAccountService.findOrCreate
[shared] CategorizationService.categorize
[shared] MerchantExtractor.extract
[shared] importHash dedup → transactionRepository.save
[shared] ImportBatch link
```

Adding Kotak introduces **one new class** (`KotakStatementParser`), **one new method** (`ImportService.importKotakFiles`), **one new endpoint** (`/api/import/kotak`), and **one new test class** (`KotakStatementParserTest`). All other behaviour is reused.

---

## Backend Design

### `KotakStatementParser` (new)

`src/main/java/com/omprakashgautam/homelab/spends/service/KotakStatementParser.java`

Public surface:
```java
@Component
public class KotakStatementParser {
    public ParsedStatement parse(MultipartFile file) throws IOException
}
```

Constants:
```java
private static final int COL_SEQ         = 0;
private static final int COL_DATE        = 1;
private static final int COL_DESCRIPTION = 2;
private static final int COL_CHEQ_REF    = 3;
private static final int COL_WITHDRAWAL  = 4;
private static final int COL_DEPOSIT     = 5;
private static final int COL_BALANCE     = 6;

private static final DateTimeFormatter DATE_FMT =
        DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);
```

Parse flow:

1. Read CSV via Apache Commons CSV (already on classpath, used by BoB parser).
2. **Metadata pass** — iterate until header row `(col[0]=="#" && col[1]=="Date")`:
   - Holder name + raw account number captured when col[4] starts with `Account No.`.
   - Mask raw account number: `mask("4550925349") → "455XXXX349"` (first 3, X for middle, last 3).
   - Record `dataStartIdx = i + 1` and break.
3. **Transaction pass** — iterate from `dataStartIdx`:
   - **Skip** opening balance: col[0] == `-`.
   - **Skip** page footers: col[0] starts with `Statement Generated on` (case-insensitive).
   - **Continuation row**: col[0] blank AND col[1] blank AND col[2] non-blank AND a previous transaction exists → append `" " + col[2].trim()` to the previous transaction's `rawRemarks` and `continue`.
   - **Transaction start**: col[0] is a numeric integer string → parse:
     - `date = LocalDate.parse(col[1].trim(), DATE_FMT)`
     - `description = col[2].trim()`
     - `chequeRef = col[3].trim()` (null if blank)
     - `withdrawal = parseMoney(col[4])`, `deposit = parseMoney(col[5])`, `balance = parseMoney(col[6])`
     - Construct `ParsedTransaction(valueDate=date, transactionDate=date, chequeNumber, rawRemarks=description, withdrawal, deposit, balance)` and add to list.
   - **Termination**: col[0] is non-numeric and not a known skip pattern → break out of the loop (catches "Account Summary", boilerplate).
4. Per-row try/catch logs and skips malformed rows (matches BoB convention).
5. Return `new ParsedStatement("Kotak Mahindra Bank", maskedAccountNumber, holderName, "Savings", transactions)`.

Helpers (private):

```java
private String maskAccount(String full)         // "4550925349" → "455XXXX349"; if length < 6, return as-is
private boolean isNumeric(String s)              // for seq detection
private boolean isContinuationRow(CSVRecord r)   // col[0] blank AND col[1] blank AND col[2] non-blank
private boolean isPageFooter(String col0)        // startsWith("Statement Generated on")
private LocalDate parseDate(String s)            // null on parse failure (logged at debug)
private BigDecimal parseMoney(String s)          // strip commas, blank → ZERO
private String get(CSVRecord r, int col)         // bounds-safe; returns "" if col >= size()
```

### Date semantics

Kotak CSV has a single date column. The `ParsedTransaction` record has both `valueDate` and `transactionDate` — set both to the parsed date. This matches how BoB handles cheque-only rows where only one date is meaningful.

### Account masking

```java
String maskAccount(String full) {
    String digits = full.replaceAll("[^0-9]", "");
    if (digits.length() < 6) return digits;          // too short to mask meaningfully
    int xs = digits.length() - 6;
    return digits.substring(0, 3)
         + "X".repeat(xs)
         + digits.substring(digits.length() - 3);
}
```

Examples:
- `4550925349` (10 digits) → `455XXXX349`
- `123456789012` (12 digits) → `123XXXXXX012`

### `ImportService` changes

Add field + method (mirror BoB):

```java
private final KotakStatementParser kotakParser;

@Transactional
public ImportResultDto.Response importKotakFiles(UUID userId, List<MultipartFile> files) {
    return importFilesWith(userId, files, kotakParser::parse);
}
```

`StatementParserFn`, `importFilesWith`, and `importSingleFile` are unchanged.

### `ImportController` changes

Add sibling endpoint:

```java
@PostMapping("/kotak")
public ImportResultDto.Response importKotak(
        @AuthenticationPrincipal UserDetailsImpl principal,
        @RequestParam("files") List<MultipartFile> files) {
    return importService.importKotakFiles(principal.getId(), files);
}
```

Path: `POST /api/import/kotak`.

### Tests

`src/test/java/com/omprakashgautam/homelab/spends/service/KotakStatementParserTest.java` (new)

8 tests using inline string fixtures (BoB style, no test resource files):

1. **`parsesMetadataFromHeader`** — extracts holder name "Omprakash Harishchandra Gautam" and masked account `455XXXX349` from the header section.
2. **`parsesWithdrawalRow`** — single transaction with non-zero withdrawal, zero deposit, correct date and balance.
3. **`parsesDepositRow`** — single transaction with zero withdrawal, non-zero deposit (e.g. salary credit or REV-UPI reversal).
4. **`mergesContinuationRow`** — `rawRemarks` for row 4 equals `"UPI/OMPRAKASH HARIS/600318766885/Early Jan spend"` (single space, both fragments).
5. **`skipsOpeningBalance`** — row with col[0]==`-` is not emitted as a transaction.
6. **`skipsPageFooter`** — `Statement Generated on …` row appearing mid-fixture does not break parsing or emit a transaction.
7. **`masksAccountNumberCorrectly`** — `maskAccount("4550925349")` returns `"455XXXX349"` (assertion via parsed-statement output).
8. **`terminatesAtAccountSummaryFooter`** — content following an unexpected non-numeric col[0] (simulating "Account Summary" boilerplate) ends the transaction loop without errors and returns the transactions parsed up to that point.

Existing `ImportServiceTest` is **not** modified — Kotak file routing is identical to BoB and exercising it again would be redundant.

---

## Frontend Design

### `api/importStatements.ts`

Add the third bank import function (mirrors `importBobFiles`):

```ts
export async function importKotakFiles(files: File[]): Promise<ImportResult> {
  const form = new FormData();
  files.forEach(f => form.append('files', f));
  const { data } = await apiClient.post('/import/kotak', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
```

### `ImportPage.tsx`

- Extend the bank-selector union: `type Bank = 'ICICI' | 'BOB' | 'KOTAK'`.
- Add `<option value="KOTAK">Kotak Mahindra Bank</option>` to the dropdown.
- `acceptByBank` map: `KOTAK: '.csv'` (same as BoB).
- `dropZoneHintByBank` map: `KOTAK: 'Drop your Kotak Net Banking CSV files here'`.
- `errorByBank` map: `KOTAK: 'Only .csv files are accepted for Kotak imports.'`.
- Mutation dispatch: `selectedBank === 'KOTAK' ? importKotakFiles(files) : ...`.
- The existing `selectedBank` change handler already resets file selection and previous result — no extra work.

---

## Sample File

Save the user-provided CSV (with `_unlocked` suffix dropped from filename) to:

```
spend-stack/om-bank-statements/kotak/455XXXX349_03-01-2026_29-04-2026.csv
```

This matches the existing layout (ICICI fixtures live at `spend-stack/om-bank-statements/icici/`). The file is for manual sanity-checks only — automated tests use inline fixtures.

---

## Documentation Updates

After implementation:

- **`spends/CLAUDE.md`** — under "API Endpoints (implemented)", add a row for `POST /api/import/kotak` next to the existing `/icici` and `/bob` rows. Append a new "Phase / Feature" entry titled **Feature — Kotak Mahindra Bank CSV Import** with a brief summary mirroring the BoB feature entry.
- **`memory/project_roadmap.md`** — move Kotak from backlog to completed; remaining backlog: HDFC, SBI, Axis.

---

## Risks & Edge Cases

| Risk | Mitigation |
|---|---|
| Kotak adds new column or changes header text | Header detection is content-based (`col[0]=="#" && col[1]=="Date"`) — resilient to row position changes; column-name change would surface as a single failed test |
| Multi-line descriptions exceed two rows | Continuation logic appends to "previous transaction" iteratively — N continuation rows would all be merged. Fixture covers 2-row case; if 3+ rows exist in the wild, the same logic still applies |
| Transaction with both withdrawal AND deposit non-zero | Schema permits this. Existing BoB logic handles it. Kotak appears never to do this in the sample, but no special case needed |
| Account number with non-digit characters | `maskAccount` strips non-digits before masking — no NumberFormatException possible |
| Empty file or only-headers file | Parser returns `ParsedStatement` with empty transactions list — `importFilesWith` handles zero transactions gracefully (existing behaviour) |
| Existing user already has a Kotak account in `bank_account` from manual entry | `BankAccountService.findOrCreate` matches on `(userId, bankName, accountNumberMasked)` — if the user previously typed `Kotak Mahindra Bank` and `455XXXX349` exactly, it reuses; otherwise creates a duplicate row. Acceptable: existing behaviour for all banks |

---

## Acceptance Criteria

1. User can select **Kotak Mahindra Bank** from the Import page bank dropdown.
2. Uploading the sample CSV at `spend-stack/om-bank-statements/kotak/455XXXX349_03-01-2026_29-04-2026.csv` results in 107 imported transactions with correct dates, amounts, balances, and merged multi-line descriptions.
3. Re-uploading the same file results in 107 duplicates and 0 new imports.
4. Auto-categorization runs (categorization rate visible in import-result confidence badge — must be > 0%; expected ~50–80% given many UPI rows match existing global rules).
5. Transactions appear in the Transactions list and Dashboard with `bankName="Kotak Mahindra Bank"` and `accountNumberMasked="455XXXX349"`.
6. All 8 new `KotakStatementParserTest` tests pass; full backend test suite (now ≥ 113 tests) passes.
7. Frontend build succeeds; manual smoke test on dev server confirms dropdown, file selection, and successful import end-to-end.
