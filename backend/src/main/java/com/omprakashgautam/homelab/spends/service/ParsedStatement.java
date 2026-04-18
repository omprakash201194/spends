package com.omprakashgautam.homelab.spends.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record ParsedStatement(
        String bankName,
        String accountNumberMasked,
        String accountHolderName,
        String accountType,
        List<ParsedTransaction> transactions
) {
    public record ParsedTransaction(
            LocalDate valueDate,
            LocalDate transactionDate,
            String chequeNumber,
            String rawRemarks,
            BigDecimal withdrawalAmount,
            BigDecimal depositAmount,
            BigDecimal balance
    ) {}
}
