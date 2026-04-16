# Import History & Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track each file import as a batch, list import history on the Import page, and allow deleting all transactions from a specific import or deleting all transactions entirely.

**Architecture:** A new `import_batch` table records each file processed during an import. `financial_transaction` gains a nullable `import_batch_id` FK (null for data imported before this feature). The backend exposes GET /api/import/history, DELETE /api/import/batches/{id}, and DELETE /api/import/all. The Import page adds an Import History section below the upload area with per-batch delete and a global "Delete All" action.

**Tech Stack:** Spring Boot 3.3.4 / Java 21 / Liquibase / JPA (Hibernate 6) / React 18 + TypeScript / TanStack Query v5 / TailwindCSS 3

---

## File Map

| Action | File |
|--------|------|
| Create | `backend/src/main/resources/db/changelog/changes/008-import-batch.sql` |
| Modify | `backend/src/main/resources/db/changelog/db.changelog-master.xml` |
| Create | `backend/src/main/java/com/omprakashgautam/homelab/spends/model/ImportBatch.java` |
| Modify | `backend/src/main/java/com/omprakashgautam/homelab/spends/model/Transaction.java` |
| Create | `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/ImportBatchRepository.java` |
| Modify | `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionRepository.java` |
| Create | `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/ImportBatchDto.java` |
| Modify | `backend/src/main/java/com/omprakashgautam/homelab/spends/service/ImportService.java` |
| Modify | `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/ImportController.java` |
| Create | `backend/src/test/java/com/omprakashgautam/homelab/spends/service/ImportServiceTest.java` |
| Modify | `frontend/src/api/importStatements.ts` |
| Modify | `frontend/src/pages/ImportPage.tsx` |

---

## Codebase Context

**Package root:** `com.omprakashgautam.homelab.spends`

**`Transaction` entity** (`model/Transaction.java`):
- Table: `financial_transaction`
- Key fields: `id` (UUID), `bankAccount` (ManyToOne → BankAccount), `importHash` (unique string), `withdrawalAmount`, `depositAmount`, `valueDate`, `category` (ManyToOne → Category)
- Uses Lombok `@Data @NoArgsConstructor @AllArgsConstructor @Builder`

**`BankAccount` entity**:
- Fields: `id`, `user` (ManyToOne → User, FetchType.LAZY), `bankName`, `accountNumberMasked`
- JPQL path `bankAccount.user.id` is used throughout existing queries

**`ImportService.importFiles(UUID userId, List<MultipartFile> files)`**:
- `@Transactional` — loops files, calls `importSingleFile` per file, accumulates totals
- `importSingleFile` calls `parser.parse(file)` → `bankAccountService.findOrCreate(...)` → loops parsed transactions → saves each via `transactionRepository.save(transaction)`
- Returns `ImportResultDto.Response(totalImported, totalDuplicates, totalErrors, List<FileSummary>)`

**`ImportResultDto`** has two records: `FileSummary(fileName, bankName, accountNumberMasked, bankAccountId, imported, duplicates, errors)` and `Response(totalImported, totalDuplicates, totalErrors, List<FileSummary>)`.

**Existing DB cascade rules** (relevant):
- `view_transaction.transaction_id REFERENCES financial_transaction(id) ON DELETE CASCADE` — deleting a transaction auto-removes its view links
- `financial_transaction.bank_account_id` has no ON DELETE CASCADE from bank_account (intentional)

**Existing `TransactionRepository`**: extends `JpaRepository<Transaction, UUID>` and `JpaSpecificationExecutor<Transaction>`. Has `existsByImportHash(String)` and several `@Query` methods using JPQL paths like `t.bankAccount.user.id = :userId`.

**Frontend `importStatements.ts`**: exports `importIciciFiles(files)` using `apiClient` (Axios). `ImportPage.tsx` uses `useMutation` from TanStack Query v5 for the import POST.

---

### Task 1: DB Migration + ImportBatch Entity + Repository + DTO

**Files:**
- Create: `backend/src/main/resources/db/changelog/changes/008-import-batch.sql`
- Modify: `backend/src/main/resources/db/changelog/db.changelog-master.xml`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/model/ImportBatch.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/ImportBatchRepository.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/ImportBatchDto.java`

- [ ] **Step 1: Write migration SQL**

Create `backend/src/main/resources/db/changelog/changes/008-import-batch.sql`:

```sql
--liquibase formatted sql

--changeset omprakash:008-import-batch

CREATE TABLE import_batch (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id   UUID         NOT NULL REFERENCES bank_account(id),
    original_filename VARCHAR(500) NOT NULL,
    imported_at       TIMESTAMP    NOT NULL DEFAULT now(),
    transaction_count INT          NOT NULL DEFAULT 0,
    duplicate_count   INT          NOT NULL DEFAULT 0
);

CREATE INDEX idx_import_batch_bank_account ON import_batch(bank_account_id);

ALTER TABLE financial_transaction
    ADD COLUMN import_batch_id UUID REFERENCES import_batch(id) ON DELETE CASCADE;

CREATE INDEX idx_transaction_import_batch ON financial_transaction(import_batch_id);
```

Note: `import_batch_id` is nullable so existing transactions (with no batch) remain valid. `ON DELETE CASCADE` means deleting an `import_batch` row automatically deletes its transactions (which then cascade to `view_transaction`).

- [ ] **Step 2: Register migration in master changelog**

In `backend/src/main/resources/db/changelog/db.changelog-master.xml`, add after the `007` include:

```xml
    <include file="db/changelog/changes/008-import-batch.sql"/>
```

- [ ] **Step 3: Create ImportBatch entity**

Create `backend/src/main/java/com/omprakashgautam/homelab/spends/model/ImportBatch.java`:

```java
package com.omprakashgautam.homelab.spends.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "import_batch")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ImportBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bank_account_id", nullable = false)
    @ToString.Exclude
    private BankAccount bankAccount;

    @Column(name = "original_filename", nullable = false)
    private String originalFilename;

    @Column(name = "imported_at", nullable = false, updatable = false)
    private LocalDateTime importedAt;

    @Column(name = "transaction_count", nullable = false)
    private int transactionCount;

    @Column(name = "duplicate_count", nullable = false)
    private int duplicateCount;

    @PrePersist
    protected void onCreate() {
        if (importedAt == null) importedAt = LocalDateTime.now();
    }
}
```

- [ ] **Step 4: Create ImportBatchRepository**

Create `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/ImportBatchRepository.java`:

```java
package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.ImportBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ImportBatchRepository extends JpaRepository<ImportBatch, UUID> {

    /** Returns all batches for the user, newest first, with bankAccount eagerly loaded. */
    @Query("""
        SELECT b FROM ImportBatch b
        JOIN FETCH b.bankAccount
        WHERE b.bankAccount.user.id = :userId
        ORDER BY b.importedAt DESC
        """)
    List<ImportBatch> findByUserIdWithAccount(@Param("userId") UUID userId);

    /** Returns true if the batch exists and belongs to the user. */
    @Query("""
        SELECT COUNT(b) > 0 FROM ImportBatch b
        WHERE b.id = :batchId AND b.bankAccount.user.id = :userId
        """)
    boolean existsByIdAndUserId(@Param("batchId") UUID batchId, @Param("userId") UUID userId);

    /** Bulk-deletes all import_batch rows for the user (for "Delete All"). */
    @Modifying
    @Query("""
        DELETE FROM ImportBatch b
        WHERE b.bankAccount.user.id = :userId
        """)
    void deleteAllByUserId(@Param("userId") UUID userId);
}
```

- [ ] **Step 5: Create ImportBatchDto**

Create `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/ImportBatchDto.java`:

```java
package com.omprakashgautam.homelab.spends.dto;

import java.util.List;
import java.util.UUID;

public class ImportBatchDto {

    public record BatchEntry(
            UUID id,
            String filename,
            String bankName,
            String accountNumberMasked,
            UUID bankAccountId,
            String importedAt,   // ISO 8601 formatted (yyyy-MM-ddTHH:mm:ss)
            int transactionCount,
            int duplicateCount
    ) {}

    public record HistoryResponse(List<BatchEntry> batches) {}
}
```

- [ ] **Step 6: Verify the app starts (migration runs)**

Run: `mvn -f backend/pom.xml spring-boot:run -Dspring-boot.run.profiles=local`

Expected: Application starts on port 8080 without errors. Liquibase log should show `008-import-batch` applied.

Stop the server with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/resources/db/changelog/changes/008-import-batch.sql \
        backend/src/main/resources/db/changelog/db.changelog-master.xml \
        backend/src/main/java/com/omprakashgautam/homelab/spends/model/ImportBatch.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/repository/ImportBatchRepository.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/dto/ImportBatchDto.java
git commit -m "feat: add import_batch table, entity, repository, and DTO"
```

---

### Task 2: Modify ImportService + Transaction Entity + TransactionRepository

**Files:**
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/model/Transaction.java`
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionRepository.java`
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/ImportService.java`

- [ ] **Step 1: Add importBatch field to Transaction entity**

In `backend/src/main/java/com/omprakashgautam/homelab/spends/model/Transaction.java`, add after the `category` field (around line 54):

```java
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "import_batch_id")
    @ToString.Exclude
    private ImportBatch importBatch;
```

The import needed at the top of the file: `import com.omprakashgautam.homelab.spends.model.ImportBatch;` — but since they're in the same package, no import is needed.

- [ ] **Step 2: Add deleteAllByUserId to TransactionRepository**

In `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionRepository.java`, add this method:

```java
    /** Bulk-deletes all transactions for the user across all their bank accounts. */
    @Modifying
    @Query("DELETE FROM Transaction t WHERE t.bankAccount.user.id = :userId")
    void deleteAllByUserId(@Param("userId") UUID userId);
```

Ensure these imports are present at the top of the file (add if missing):
```java
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
```

- [ ] **Step 3: Write the failing ImportService tests first**

Create `backend/src/test/java/com/omprakashgautam/homelab/spends/service/ImportServiceTest.java`:

```java
package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.ImportBatchDto;
import com.omprakashgautam.homelab.spends.model.BankAccount;
import com.omprakashgautam.homelab.spends.model.ImportBatch;
import com.omprakashgautam.homelab.spends.repository.ImportBatchRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ImportServiceTest {

    @Mock ImportBatchRepository importBatchRepository;
    @Mock TransactionRepository transactionRepository;
    @Mock IciciStatementParser parser;
    @Mock BankAccountService bankAccountService;
    @Mock CategorizationService categorizationService;
    @Mock MerchantExtractor merchantExtractor;

    @InjectMocks ImportService importService;

    private static final UUID USER_ID  = UUID.randomUUID();
    private static final UUID BATCH_ID = UUID.randomUUID();

    private ImportBatch buildBatch(UUID id) {
        BankAccount acct = new BankAccount();
        acct.setId(UUID.randomUUID());
        acct.setBankName("ICICI");
        acct.setAccountNumberMasked("XXXX1234");
        return ImportBatch.builder()
                .id(id)
                .bankAccount(acct)
                .originalFilename("statement.xls")
                .importedAt(LocalDateTime.of(2026, 1, 15, 10, 0))
                .transactionCount(42)
                .duplicateCount(3)
                .build();
    }

    @Test
    void getHistory_returnsMappedBatchEntries() {
        ImportBatch batch = buildBatch(BATCH_ID);
        when(importBatchRepository.findByUserIdWithAccount(USER_ID)).thenReturn(List.of(batch));

        ImportBatchDto.HistoryResponse response = importService.getHistory(USER_ID);

        assertThat(response.batches()).hasSize(1);
        ImportBatchDto.BatchEntry entry = response.batches().get(0);
        assertThat(entry.id()).isEqualTo(BATCH_ID);
        assertThat(entry.filename()).isEqualTo("statement.xls");
        assertThat(entry.bankName()).isEqualTo("ICICI");
        assertThat(entry.transactionCount()).isEqualTo(42);
        assertThat(entry.duplicateCount()).isEqualTo(3);
    }

    @Test
    void getHistory_returnsEmptyListWhenNoBatches() {
        when(importBatchRepository.findByUserIdWithAccount(USER_ID)).thenReturn(List.of());

        ImportBatchDto.HistoryResponse response = importService.getHistory(USER_ID);

        assertThat(response.batches()).isEmpty();
    }

    @Test
    void deleteBatch_throwsNotFoundWhenBatchDoesNotBelongToUser() {
        when(importBatchRepository.existsByIdAndUserId(BATCH_ID, USER_ID)).thenReturn(false);

        assertThatThrownBy(() -> importService.deleteBatch(USER_ID, BATCH_ID))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.NOT_FOUND));

        verify(importBatchRepository, never()).deleteById(any());
    }

    @Test
    void deleteBatch_deletesWhenBatchBelongsToUser() {
        when(importBatchRepository.existsByIdAndUserId(BATCH_ID, USER_ID)).thenReturn(true);

        importService.deleteBatch(USER_ID, BATCH_ID);

        verify(importBatchRepository).deleteById(BATCH_ID);
    }

    @Test
    void deleteAll_deletesTransactionsThenBatches() {
        importService.deleteAll(USER_ID);

        verify(transactionRepository).deleteAllByUserId(USER_ID);
        verify(importBatchRepository).deleteAllByUserId(USER_ID);
    }
}
```

- [ ] **Step 4: Run tests — verify they fail**

Run: `mvn -f backend/pom.xml test -Dtest=ImportServiceTest -q 2>&1 | grep -E "Tests run:|ERROR|FAIL|BUILD"`

Expected: `BUILD FAILURE` — methods `getHistory`, `deleteBatch`, `deleteAll` do not exist yet on ImportService.

- [ ] **Step 5: Modify ImportService**

Replace the full content of `backend/src/main/java/com/omprakashgautam/homelab/spends/service/ImportService.java`:

```java
package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.ImportBatchDto;
import com.omprakashgautam.homelab.spends.dto.ImportResultDto;
import com.omprakashgautam.homelab.spends.model.BankAccount;
import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.ImportBatch;
import com.omprakashgautam.homelab.spends.model.Transaction;
import com.omprakashgautam.homelab.spends.repository.ImportBatchRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ImportService {

    private final IciciStatementParser parser;
    private final BankAccountService bankAccountService;
    private final CategorizationService categorizationService;
    private final MerchantExtractor merchantExtractor;
    private final TransactionRepository transactionRepository;
    private final ImportBatchRepository importBatchRepository;

    @Transactional
    public ImportResultDto.Response importFiles(UUID userId, List<MultipartFile> files) {
        List<ImportResultDto.FileSummary> summaries = new ArrayList<>();
        int totalImported = 0;
        int totalDuplicates = 0;
        int totalErrors = 0;

        for (MultipartFile file : files) {
            ImportResultDto.FileSummary summary = importSingleFile(userId, file);
            summaries.add(summary);
            totalImported   += summary.imported();
            totalDuplicates += summary.duplicates();
            totalErrors     += summary.errors();
        }

        return new ImportResultDto.Response(totalImported, totalDuplicates, totalErrors, summaries);
    }

    private ImportResultDto.FileSummary importSingleFile(UUID userId, MultipartFile file) {
        String fileName = file.getOriginalFilename() == null ? "unknown" : file.getOriginalFilename();
        int imported = 0;
        int duplicates = 0;
        int errors = 0;
        BankAccount bankAccount = null;
        ImportBatch batch = null;

        try {
            IciciStatementParser.ParsedStatement statement = parser.parse(file);

            bankAccount = bankAccountService.findOrCreate(
                    userId,
                    statement.bankName(),
                    statement.accountNumberMasked(),
                    statement.accountType()
            );

            // Create the batch record so every imported transaction is linked to it
            batch = importBatchRepository.save(ImportBatch.builder()
                    .bankAccount(bankAccount)
                    .originalFilename(fileName)
                    .transactionCount(0)
                    .duplicateCount(0)
                    .build());

            for (IciciStatementParser.ParsedTransaction tx : statement.transactions()) {
                try {
                    String hash = computeImportHash(
                            bankAccount.getId(),
                            tx.valueDate().toString(),
                            tx.withdrawalAmount().toPlainString(),
                            tx.depositAmount().toPlainString(),
                            tx.rawRemarks()
                    );

                    if (transactionRepository.existsByImportHash(hash)) {
                        duplicates++;
                        continue;
                    }

                    Category category = categorizationService.categorize(userId, tx.rawRemarks());
                    String merchantName = merchantExtractor.extract(tx.rawRemarks());

                    Transaction transaction = Transaction.builder()
                            .bankAccount(bankAccount)
                            .importBatch(batch)
                            .valueDate(tx.valueDate())
                            .transactionDate(tx.transactionDate())
                            .chequeNumber(tx.chequeNumber())
                            .rawRemarks(tx.rawRemarks())
                            .merchantName(merchantName)
                            .withdrawalAmount(tx.withdrawalAmount())
                            .depositAmount(tx.depositAmount())
                            .balance(tx.balance())
                            .category(category)
                            .importHash(hash)
                            .build();

                    transactionRepository.save(transaction);
                    imported++;
                } catch (Exception e) {
                    log.warn("Error saving transaction from file {}: {}", fileName, e.getMessage());
                    errors++;
                }
            }

            // Persist final counts on the batch record
            batch.setTransactionCount(imported);
            batch.setDuplicateCount(duplicates);
            importBatchRepository.save(batch);

        } catch (Exception e) {
            log.error("Failed to parse file {}: {}", fileName, e.getMessage(), e);
            errors++;
        }

        return new ImportResultDto.FileSummary(
                fileName,
                bankAccount != null ? bankAccount.getBankName() : "Unknown",
                bankAccount != null ? bankAccount.getAccountNumberMasked() : null,
                bankAccount != null ? bankAccount.getId() : null,
                imported,
                duplicates,
                errors
        );
    }

    // ── History & delete ──────────────────────────────────────────────────────

    public ImportBatchDto.HistoryResponse getHistory(UUID userId) {
        List<ImportBatch> batches = importBatchRepository.findByUserIdWithAccount(userId);
        List<ImportBatchDto.BatchEntry> entries = batches.stream()
                .map(b -> new ImportBatchDto.BatchEntry(
                        b.getId(),
                        b.getOriginalFilename(),
                        b.getBankAccount().getBankName(),
                        b.getBankAccount().getAccountNumberMasked(),
                        b.getBankAccount().getId(),
                        b.getImportedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
                        b.getTransactionCount(),
                        b.getDuplicateCount()
                ))
                .toList();
        return new ImportBatchDto.HistoryResponse(entries);
    }

    @Transactional
    public void deleteBatch(UUID userId, UUID batchId) {
        if (!importBatchRepository.existsByIdAndUserId(batchId, userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Import batch not found");
        }
        // Deleting the batch cascades to financial_transaction (ON DELETE CASCADE in migration 008),
        // which in turn cascades to view_transaction (ON DELETE CASCADE in migration 007).
        importBatchRepository.deleteById(batchId);
    }

    @Transactional
    public void deleteAll(UUID userId) {
        // Delete transactions first — DB cascade removes view_transaction links
        transactionRepository.deleteAllByUserId(userId);
        // Delete batch records — their transactions are already gone
        importBatchRepository.deleteAllByUserId(userId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String computeImportHash(UUID bankAccountId, String date,
                                     String withdrawal, String deposit, String remarks) {
        try {
            String raw = bankAccountId + "|" + date + "|" + withdrawal + "|" + deposit + "|" + remarks;
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException("Failed to compute import hash", e);
        }
    }
}
```

- [ ] **Step 6: Run tests — verify they pass**

Run: `mvn -f backend/pom.xml test -Dtest=ImportServiceTest -q 2>&1 | grep -E "Tests run:|ERROR|BUILD"`

Expected: `Tests run: 5, Failures: 0, Errors: 0` and `BUILD SUCCESS`.

- [ ] **Step 7: Run full test suite**

Run: `mvn -f backend/pom.xml test -q 2>&1 | grep -E "Tests run:|BUILD"`

Expected: All tests pass, `BUILD SUCCESS`.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/model/Transaction.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionRepository.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/service/ImportService.java \
        backend/src/test/java/com/omprakashgautam/homelab/spends/service/ImportServiceTest.java
git commit -m "feat: link transactions to import batches, add history and delete methods"
```

---

### Task 3: ImportController — History and Delete Endpoints

**Files:**
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/ImportController.java`

- [ ] **Step 1: Add three endpoints to ImportController**

Replace the full content of `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/ImportController.java`:

```java
package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.ImportBatchDto;
import com.omprakashgautam.homelab.spends.dto.ImportResultDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.ImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/import")
@RequiredArgsConstructor
public class ImportController {

    private final ImportService importService;

    /**
     * Upload one or more ICICI bank statement XLS/XLSX files.
     * Returns a summary of imported, duplicate, and error counts.
     */
    @PostMapping(value = "/icici", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportResultDto.Response> importIcici(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestPart("files") List<MultipartFile> files) {

        if (files == null || files.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        ImportResultDto.Response result = importService.importFiles(principal.getId(), files);
        return ResponseEntity.ok(result);
    }

    /**
     * Returns all import batches for the current user, newest first.
     */
    @GetMapping("/history")
    public ResponseEntity<ImportBatchDto.HistoryResponse> getHistory(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        return ResponseEntity.ok(importService.getHistory(principal.getId()));
    }

    /**
     * Deletes a specific import batch and all its transactions.
     * Returns 404 if the batch does not exist or does not belong to the user.
     */
    @DeleteMapping("/batches/{batchId}")
    public ResponseEntity<Void> deleteBatch(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @PathVariable UUID batchId) {
        importService.deleteBatch(principal.getId(), batchId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Deletes ALL transactions for the current user across all accounts and batches.
     * This is irreversible.
     */
    @DeleteMapping("/all")
    public ResponseEntity<Void> deleteAll(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        importService.deleteAll(principal.getId());
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 2: Run full test suite**

Run: `mvn -f backend/pom.xml test -q 2>&1 | grep -E "Tests run:|BUILD"`

Expected: All 29 tests pass (24 existing + 5 new), `BUILD SUCCESS`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/controller/ImportController.java
git commit -m "feat: add GET /api/import/history and DELETE /api/import/batches/{id} and /api/import/all"
```

---

### Task 4: Frontend — Import History Section + Delete UI

**Files:**
- Modify: `frontend/src/api/importStatements.ts`
- Modify: `frontend/src/pages/ImportPage.tsx`

- [ ] **Step 1: Add history/delete API functions to importStatements.ts**

Append to `frontend/src/api/importStatements.ts` (keep existing exports intact, add below them):

```typescript
export interface BatchEntry {
  id: string
  filename: string
  bankName: string
  accountNumberMasked: string | null
  bankAccountId: string
  importedAt: string   // ISO 8601: "2026-04-16T10:30:00"
  transactionCount: number
  duplicateCount: number
}

export async function getImportHistory(): Promise<BatchEntry[]> {
  const { data } = await apiClient.get<{ batches: BatchEntry[] }>('/import/history')
  return data.batches
}

export async function deleteImportBatch(batchId: string): Promise<void> {
  await apiClient.delete(`/import/batches/${batchId}`)
}

export async function deleteAllTransactions(): Promise<void> {
  await apiClient.delete('/import/all')
}
```

- [ ] **Step 2: Replace ImportPage.tsx with history section and delete UI**

Replace the full content of `frontend/src/pages/ImportPage.tsx`:

```tsx
import { useState, useRef, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Copy, Trash2, History, Clock } from 'lucide-react'
import {
  importIciciFiles,
  getImportHistory,
  deleteImportBatch,
  deleteAllTransactions,
  type ImportResult,
  type BatchEntry,
} from '../api/importStatements'
import { clsx } from 'clsx'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Formats ISO datetime string as "16 Apr 2026, 10:30 AM" */
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // ── Import history query ────────────────────────────────────────────────────

  const { data: history = [] } = useQuery({
    queryKey: ['import-history'],
    queryFn: getImportHistory,
    staleTime: 30_000,
  })

  // ── Import mutation ─────────────────────────────────────────────────────────

  const importMut = useMutation({
    mutationFn: importIciciFiles,
    onSuccess: (data) => {
      setResult(data)
      setFiles([])
      queryClient.invalidateQueries({ queryKey: ['import-history'] })
    },
  })

  // ── Delete batch mutation ───────────────────────────────────────────────────

  const deleteBatchMut = useMutation({
    mutationFn: (batchId: string) => deleteImportBatch(batchId),
    onSuccess: () => {
      setDeletingBatchId(null)
      queryClient.invalidateQueries({ queryKey: ['import-history'] })
    },
  })

  // ── Delete all mutation ─────────────────────────────────────────────────────

  const deleteAllMut = useMutation({
    mutationFn: deleteAllTransactions,
    onSuccess: () => {
      setConfirmDeleteAll(false)
      queryClient.invalidateQueries({ queryKey: ['import-history'] })
    },
  })

  // ── File handling ───────────────────────────────────────────────────────────

  const addFiles = useCallback((incoming: File[]) => {
    const xlsFiles = incoming.filter(
      (f) => f.name.endsWith('.xls') || f.name.endsWith('.xlsx')
    )
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name))
      return [...prev, ...xlsFiles.filter((f) => !names.has(f.name))]
    })
    setResult(null)
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      addFiles(Array.from(e.dataTransfer.files))
    },
    [addFiles]
  )

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
      e.target.value = ''
    }
  }

  const removeFile = (name: string) =>
    setFiles((prev) => prev.filter((f) => f.name !== name))

  const handleImport = () => {
    if (files.length > 0) importMut.mutate(files)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Import Statements</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload ICICI bank statement XLS/XLSX files. Duplicates are automatically skipped.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={clsx(
          'relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xls,.xlsx"
          multiple
          className="hidden"
          onChange={onFileInput}
        />
        <Upload className="mx-auto w-10 h-10 text-gray-400 mb-3" />
        <p className="text-gray-700 font-medium">Drop XLS / XLSX files here</p>
        <p className="text-sm text-gray-400 mt-1">or click to browse</p>
        <p className="text-xs text-gray-400 mt-3">
          Supports ICICI Bank statement exports · Multiple files at once
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file) => (
            <div
              key={file.name}
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3"
            >
              <FileSpreadsheet className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="flex-1 text-sm text-gray-700 truncate">{file.name}</span>
              <span className="text-xs text-gray-400">
                {(file.size / 1024).toFixed(0)} KB
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(file.name) }}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          <button
            onClick={handleImport}
            disabled={importMut.isPending}
            className="w-full mt-2 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {importMut.isPending
              ? `Importing ${files.length} file${files.length > 1 ? 's' : ''}…`
              : `Import ${files.length} file${files.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Error */}
      {importMut.isError && (
        <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">
            Import failed. Please check that the files are valid ICICI XLS statements.
          </p>
        </div>
      )}

      {/* Result summary */}
      {result && <ImportSummary result={result} />}

      {/* ── Import History ──────────────────────────────────────────────────── */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">Import History</h2>
            {history.length > 0 && (
              <span className="text-xs text-gray-400">({history.length})</span>
            )}
          </div>

          {/* Delete All button / confirmation */}
          {history.length > 0 && (
            <div className="flex items-center gap-2">
              {confirmDeleteAll ? (
                <>
                  <span className="text-xs text-red-600 font-medium">Delete ALL transactions?</span>
                  <button
                    onClick={() => deleteAllMut.mutate()}
                    disabled={deleteAllMut.isPending}
                    className="text-xs px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deleteAllMut.isPending ? 'Deleting…' : 'Yes, delete all'}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteAll(false)}
                    className="text-xs px-2.5 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmDeleteAll(true)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete All Transactions
                </button>
              )}
            </div>
          )}
        </div>

        {history.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl">
            <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No imports yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((batch) => (
              <BatchRow
                key={batch.id}
                batch={batch}
                isDeleting={deletingBatchId === batch.id}
                isPending={deleteBatchMut.isPending && deletingBatchId === batch.id}
                onDeleteClick={() => setDeletingBatchId(batch.id)}
                onDeleteConfirm={() => deleteBatchMut.mutate(batch.id)}
                onDeleteCancel={() => setDeletingBatchId(null)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Batch row ─────────────────────────────────────────────────────────────────

function BatchRow({
  batch,
  isDeleting,
  isPending,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  batch: BatchEntry
  isDeleting: boolean
  isPending: boolean
  onDeleteClick: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <div className="flex items-start gap-3">
        <FileSpreadsheet className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{batch.filename}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {batch.bankName}
            {batch.accountNumberMasked ? ` · ${batch.accountNumberMasked}` : ''}
            {' · '}
            {fmtDateTime(batch.importedAt)}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <span className="text-xs text-green-600 font-medium">{batch.transactionCount} imported</span>
            {batch.duplicateCount > 0 && (
              <span className="text-xs text-amber-600 ml-2">{batch.duplicateCount} dup</span>
            )}
          </div>
          {!isDeleting ? (
            <button
              onClick={onDeleteClick}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete this import"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onDeleteConfirm}
                disabled={isPending}
                className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors disabled:opacity-50"
              >
                {isPending ? '…' : 'Delete'}
              </button>
              <button
                onClick={onDeleteCancel}
                className="text-xs px-2 py-1 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Import summary ────────────────────────────────────────────────────────────

function ImportSummary({ result }: { result: ImportResult }) {
  return (
    <div className="mt-6 space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <h2 className="font-semibold text-gray-900">Import Complete</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Imported"          value={result.totalImported}   color="text-green-600" bg="bg-green-50" />
          <StatCard label="Duplicates skipped" value={result.totalDuplicates} color="text-amber-600" bg="bg-amber-50" />
          <StatCard label="Errors"             value={result.totalErrors}     color="text-red-600"   bg="bg-red-50" />
        </div>
      </div>

      {result.files.length > 1 && (
        <div className="space-y-2">
          {result.files.map((f) => (
            <div
              key={f.fileName}
              className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3"
            >
              <Copy className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{f.fileName}</p>
                <p className="text-xs text-gray-500">
                  {f.bankName}
                  {f.accountNumberMasked ? ` · ${f.accountNumberMasked}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-green-600 font-medium">{f.imported} new</span>
                <span className="text-amber-600">{f.duplicates} dup</span>
                {f.errors > 0 && <span className="text-red-600">{f.errors} err</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={clsx('rounded-lg p-4 text-center', bg)}>
      <p className={clsx('text-2xl font-bold', color)}>{value.toLocaleString()}</p>
      <p className="text-xs text-gray-600 mt-1">{label}</p>
    </div>
  )
}
```

- [ ] **Step 3: Run full backend test suite**

Run: `mvn -f backend/pom.xml test -q 2>&1 | grep -E "Tests run:|BUILD"`

Expected: All 29 tests pass, `BUILD SUCCESS`.

- [ ] **Step 4: Verify frontend builds without TypeScript errors**

Run: `cd frontend && npm run build 2>&1 | tail -10`

Expected: Build succeeds with no TypeScript errors. `dist/` directory created.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/importStatements.ts \
        frontend/src/pages/ImportPage.tsx
git commit -m "feat: add import history listing and delete by batch / delete all UI"
```

---

## Self-Review

### 1. Spec Coverage

| Requirement | Task |
|-------------|------|
| Track each file import as a batch | Task 1 (DB), Task 2 (service wiring) |
| List import history on Import page | Task 3 (endpoint), Task 4 (UI) |
| Delete all transactions from a specific import | Task 3 (endpoint), Task 4 (per-row delete) |
| Delete all transactions entirely | Task 3 (endpoint), Task 4 (Delete All button) |
| Confirmation before delete | Task 4 (inline confirm for both batch and all) |

All requirements covered. ✓

### 2. Placeholder Scan

No "TBD", "TODO", or missing code blocks found. ✓

### 3. Type Consistency

- `ImportBatch` entity field `originalFilename` → DTO field `filename` (intentional renaming for cleaner API, set in service mapping)
- `ImportBatchDto.BatchEntry.importedAt` is `String` (ISO formatted in service, parsed with `new Date()` in frontend)
- `deleteBatch(UUID userId, UUID batchId)` in service matches controller call `importService.deleteBatch(principal.getId(), batchId)` ✓
- `deleteAllByUserId(UUID userId)` on both repositories matches service calls ✓
- Frontend `BatchEntry.id: string` matches `UUID` serialized by Jackson as a lowercase UUID string ✓

### 4. Edge Cases Handled

- **Legacy transactions** (imported before this feature, `import_batch_id = NULL`): "Delete All" deletes them via `transactionRepository.deleteAllByUserId` which has no `import_batch_id` condition.
- **Parse failure**: If `parser.parse(file)` throws, `batch` is never created (it's only created after successful parse + bankAccount lookup). No orphaned batch records.
- **Empty batch** (all transactions were duplicates): Batch is still saved with `transactionCount = 0, duplicateCount = N`. This is correct — it shows in history so the user knows the import was attempted.
- **Cascade correctness**: `DELETE FROM import_batch WHERE id = ?` → DB cascades to `financial_transaction` (import_batch_id FK ON DELETE CASCADE) → DB cascades to `view_transaction` (transaction_id FK ON DELETE CASCADE already in migration 007).
