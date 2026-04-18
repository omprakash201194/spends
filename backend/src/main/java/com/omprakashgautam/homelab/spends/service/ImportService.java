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
        int categorized = 0;
        BankAccount bankAccount = null;
        ImportBatch batch = null;
        List<ImportResultDto.DuplicateEntry> duplicateRows = new ArrayList<>();
        List<ImportResultDto.ErrorEntry> errorRows = new ArrayList<>();

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
                        duplicateRows.add(new ImportResultDto.DuplicateEntry(
                                tx.valueDate(), tx.withdrawalAmount(), tx.depositAmount(), tx.rawRemarks()));
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
                    if (category != null && !"Miscellaneous".equals(category.getName())) {
                        categorized++;
                    }
                } catch (Exception e) {
                    log.warn("Error saving transaction from file {}: {}", fileName, e.getMessage());
                    errorRows.add(new ImportResultDto.ErrorEntry(tx.rawRemarks(), e.getMessage()));
                }
            }

            // Persist final counts on the batch record
            batch.setTransactionCount(imported);
            batch.setDuplicateCount(duplicateRows.size());
            importBatchRepository.save(batch);

        } catch (Exception e) {
            log.error("Failed to parse file {}: {}", fileName, e.getMessage(), e);
            errorRows.add(new ImportResultDto.ErrorEntry(null, e.getMessage()));
        }

        int misc = imported - categorized;
        int pct = imported > 0 ? (categorized * 100 / imported) : 0;

        return new ImportResultDto.FileSummary(
                fileName,
                bankAccount != null ? bankAccount.getBankName() : "Unknown",
                bankAccount != null ? bankAccount.getAccountNumberMasked() : null,
                bankAccount != null ? bankAccount.getId() : null,
                imported,
                duplicateRows.size(),
                errorRows.size(),
                categorized,
                misc,
                pct,
                duplicateRows,
                errorRows
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
        // Delete transactions first — DB cascade removes view_transaction links (migration 007)
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
