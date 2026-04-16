package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.model.BankAccount;
import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.Transaction;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExportServiceTest {

    @Mock
    TransactionService transactionService;

    @InjectMocks
    ExportService exportService;

    // ── CSV escaping unit tests (no mock needed) ──────────────────────────────

    @Test
    void escape_nullReturnsEmpty() {
        assertThat(ExportService.escape(null)).isEmpty();
    }

    @Test
    void escape_plainTextUnchanged() {
        assertThat(ExportService.escape("Swiggy")).isEqualTo("Swiggy");
    }

    @Test
    void escape_commaWrapsInQuotes() {
        assertThat(ExportService.escape("Swiggy, Zomato")).isEqualTo("\"Swiggy, Zomato\"");
    }

    @Test
    void escape_doubleQuoteEscapedAndWrapped() {
        assertThat(ExportService.escape("She said \"hi\"")).isEqualTo("\"She said \"\"hi\"\"\"");
    }

    // ── CSV generation tests ──────────────────────────────────────────────────

    @Test
    void csv_headerRow_isPresent() {
        when(transactionService.listAll(any(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull()))
                .thenReturn(List.of());

        String csv = exportService.exportTransactionsCsv(
                UUID.randomUUID(), null, null, null, null, null, null);

        String header = csv.split("\n")[0];
        assertThat(header).isEqualTo(
                "Date,Transaction Date,Merchant,Category,Withdrawal (INR),Deposit (INR),Balance (INR),Remarks,Account");
    }

    @Test
    void csv_emptyList_returnsOnlyHeader() {
        when(transactionService.listAll(any(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull()))
                .thenReturn(List.of());

        String csv = exportService.exportTransactionsCsv(
                UUID.randomUUID(), null, null, null, null, null, null);

        assertThat(csv.split("\n")).hasSize(1);
    }

    @Test
    void csv_remarkWithComma_isQuoted() {
        Transaction tx = buildTx("Paid to Swiggy, online", "Food & Dining", new BigDecimal("500.00"), BigDecimal.ZERO);
        when(transactionService.listAll(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(tx));

        String csv = exportService.exportTransactionsCsv(
                UUID.randomUUID(), null, null, null, null, null, null);

        assertThat(csv).contains("\"Paid to Swiggy, online\"");
    }

    @Test
    void csv_nullCategory_writesEmpty() {
        Transaction tx = buildTxNoCategory("plain remark", new BigDecimal("200.00"), BigDecimal.ZERO);
        when(transactionService.listAll(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(tx));

        String csv = exportService.exportTransactionsCsv(
                UUID.randomUUID(), null, null, null, null, null, null);

        // line 2 (data row), category column (index 3) should be empty — two consecutive commas
        String dataRow = csv.split("\n")[1];
        String[] cols = dataRow.split(",", -1);
        assertThat(cols[3]).isEmpty();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Transaction buildTx(String remarks, String categoryName,
                                BigDecimal withdrawal, BigDecimal deposit) {
        Category cat = Category.builder()
                .id(UUID.randomUUID())
                .name(categoryName)
                .color("#ef4444")
                .build();
        BankAccount acct = BankAccount.builder()
                .id(UUID.randomUUID())
                .bankName("ICICI Bank")
                .currency("INR")
                .build();
        return Transaction.builder()
                .id(UUID.randomUUID())
                .valueDate(LocalDate.of(2025, 4, 1))
                .transactionDate(LocalDate.of(2025, 4, 1))
                .rawRemarks(remarks)
                .merchantName("TestMerchant")
                .withdrawalAmount(withdrawal)
                .depositAmount(deposit)
                .balance(new BigDecimal("10000.00"))
                .category(cat)
                .bankAccount(acct)
                .build();
    }

    private Transaction buildTxNoCategory(String remarks, BigDecimal withdrawal, BigDecimal deposit) {
        BankAccount acct = BankAccount.builder()
                .id(UUID.randomUUID())
                .bankName("ICICI Bank")
                .currency("INR")
                .build();
        return Transaction.builder()
                .id(UUID.randomUUID())
                .valueDate(LocalDate.of(2025, 4, 1))
                .transactionDate(LocalDate.of(2025, 4, 1))
                .rawRemarks(remarks)
                .merchantName("TestMerchant")
                .withdrawalAmount(withdrawal)
                .depositAmount(deposit)
                .bankAccount(acct)
                .build();
    }
}
