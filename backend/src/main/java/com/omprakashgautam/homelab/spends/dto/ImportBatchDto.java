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
            String importedAt,   // ISO 8601 formatted: "2026-04-16T10:30:00"
            int transactionCount,
            int duplicateCount
    ) {}

    public record HistoryResponse(List<BatchEntry> batches) {}
}
