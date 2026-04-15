package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.ImportResultDto;
import com.omprakashgautam.homelab.spends.model.BankAccount;
import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.Transaction;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
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

    @Transactional
    public ImportResultDto.Response importFiles(UUID userId, List<MultipartFile> files) {
        List<ImportResultDto.FileSummary> summaries = new ArrayList<>();
        int totalImported = 0;
        int totalDuplicates = 0;
        int totalErrors = 0;

        for (MultipartFile file : files) {
            ImportResultDto.FileSummary summary = importSingleFile(userId, file);
            summaries.add(summary);
            totalImported  += summary.imported();
            totalDuplicates += summary.duplicates();
            totalErrors    += summary.errors();
        }

        return new ImportResultDto.Response(totalImported, totalDuplicates, totalErrors, summaries);
    }

    private ImportResultDto.FileSummary importSingleFile(UUID userId, MultipartFile file) {
        String fileName = file.getOriginalFilename() == null ? "unknown" : file.getOriginalFilename();
        int imported = 0;
        int duplicates = 0;
        int errors = 0;
        BankAccount bankAccount = null;

        try {
            IciciStatementParser.ParsedStatement statement = parser.parse(file);

            bankAccount = bankAccountService.findOrCreate(
                    userId,
                    statement.bankName(),
                    statement.accountNumberMasked(),
                    statement.accountType()
            );

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
