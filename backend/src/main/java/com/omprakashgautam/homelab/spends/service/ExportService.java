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
