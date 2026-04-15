package com.omprakashgautam.homelab.spends.dto;

import java.util.List;
import java.util.UUID;

public class ImportResultDto {

    /** Summary for a single file. */
    public record FileSummary(
            String fileName,
            String bankName,
            String accountNumberMasked,
            UUID bankAccountId,
            int imported,
            int duplicates,
            int errors
    ) {}

    /** Aggregated result across all uploaded files. */
    public record Response(
            int totalImported,
            int totalDuplicates,
            int totalErrors,
            List<FileSummary> files
    ) {}
}
