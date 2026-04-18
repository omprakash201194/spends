package com.omprakashgautam.homelab.spends.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class ImportResultDto {

    public record DuplicateEntry(
            LocalDate date,
            BigDecimal withdrawal,
            BigDecimal deposit,
            String remarks
    ) {}

    public record ErrorEntry(
            String remarks,
            String reason
    ) {}

    /** Summary for a single file. */
    public record FileSummary(
            String fileName,
            String bankName,
            String accountNumberMasked,
            UUID bankAccountId,
            int imported,
            int duplicates,
            int errors,
            int categorized,
            int misc,
            int categorizationPct,
            List<DuplicateEntry> duplicateRows,
            List<ErrorEntry> errorRows
    ) {}

    /** Aggregated result across all uploaded files. */
    public record Response(
            int totalImported,
            int totalDuplicates,
            int totalErrors,
            List<FileSummary> files
    ) {}
}
