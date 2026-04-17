package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.ImportBatchDto;
import com.omprakashgautam.homelab.spends.dto.ImportResultDto;
import com.omprakashgautam.homelab.spends.model.BankAccount;
import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.ImportBatch;
import com.omprakashgautam.homelab.spends.repository.ImportBatchRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
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
        InOrder order = inOrder(transactionRepository, importBatchRepository);

        importService.deleteAll(USER_ID);

        order.verify(transactionRepository).deleteAllByUserId(USER_ID);
        order.verify(importBatchRepository).deleteAllByUserId(USER_ID);
    }

    // ── Confidence score tests ─────────────────────────────────────────────────

    @Test
    void importFiles_confidenceScore_twoCategorizeTwoMisc() throws Exception {
        // Set up a bank account
        BankAccount account = new BankAccount();
        account.setId(UUID.randomUUID());
        account.setBankName("ICICI");
        account.setAccountNumberMasked("XXXX5678");

        // Set up categories
        Category food = Category.builder().id(UUID.randomUUID()).name("Food & Dining").build();
        Category misc = Category.builder().id(UUID.randomUUID()).name("Miscellaneous").build();

        // Four parsed transactions: 2 matched, 2 misc
        IciciStatementParser.ParsedTransaction tx1 = new IciciStatementParser.ParsedTransaction(
                LocalDate.of(2026, 1, 10), LocalDate.of(2026, 1, 10), null,
                "SWIGGY ORDER 123", BigDecimal.TEN, BigDecimal.ZERO, BigDecimal.valueOf(1000));
        IciciStatementParser.ParsedTransaction tx2 = new IciciStatementParser.ParsedTransaction(
                LocalDate.of(2026, 1, 11), LocalDate.of(2026, 1, 11), null,
                "ZOMATO DELIVERY", BigDecimal.TEN, BigDecimal.ZERO, BigDecimal.valueOf(990));
        IciciStatementParser.ParsedTransaction tx3 = new IciciStatementParser.ParsedTransaction(
                LocalDate.of(2026, 1, 12), LocalDate.of(2026, 1, 12), null,
                "UNKNOWN MERCHANT XYZ", BigDecimal.TEN, BigDecimal.ZERO, BigDecimal.valueOf(980));
        IciciStatementParser.ParsedTransaction tx4 = new IciciStatementParser.ParsedTransaction(
                LocalDate.of(2026, 1, 13), LocalDate.of(2026, 1, 13), null,
                "RANDOM PAYMENT ABC", BigDecimal.TEN, BigDecimal.ZERO, BigDecimal.valueOf(970));

        IciciStatementParser.ParsedStatement statement = new IciciStatementParser.ParsedStatement(
                "ICICI", "XXXX5678", "OMPRAKASH HARISH", "SAVINGS",
                List.of(tx1, tx2, tx3, tx4));

        MultipartFile file = new MockMultipartFile(
                "files", "statement.xls", "application/vnd.ms-excel", new byte[]{1, 2, 3});

        ImportBatch savedBatch = buildBatch(BATCH_ID);

        when(parser.parse(file)).thenReturn(statement);
        when(bankAccountService.findOrCreate(any(), any(), any(), any())).thenReturn(account);
        when(importBatchRepository.save(any())).thenReturn(savedBatch);
        when(transactionRepository.existsByImportHash(any())).thenReturn(false);
        // tx1 + tx2 → food, tx3 + tx4 → misc
        when(categorizationService.categorize(any(), eq("SWIGGY ORDER 123"))).thenReturn(food);
        when(categorizationService.categorize(any(), eq("ZOMATO DELIVERY"))).thenReturn(food);
        when(categorizationService.categorize(any(), eq("UNKNOWN MERCHANT XYZ"))).thenReturn(misc);
        when(categorizationService.categorize(any(), eq("RANDOM PAYMENT ABC"))).thenReturn(misc);
        when(merchantExtractor.extract(any())).thenReturn("Merchant");

        ImportResultDto.Response response = importService.importFiles(USER_ID, List.of(file));

        assertThat(response.totalImported()).isEqualTo(4);
        assertThat(response.files()).hasSize(1);

        ImportResultDto.FileSummary summary = response.files().get(0);
        assertThat(summary.categorized()).isEqualTo(2);
        assertThat(summary.misc()).isEqualTo(2);
        assertThat(summary.categorizationPct()).isEqualTo(50);
    }

    @Test
    void importFiles_confidenceScore_allCategorized() throws Exception {
        BankAccount account = new BankAccount();
        account.setId(UUID.randomUUID());
        account.setBankName("ICICI");
        account.setAccountNumberMasked("XXXX9999");

        Category transport = Category.builder().id(UUID.randomUUID()).name("Transport").build();

        IciciStatementParser.ParsedTransaction tx = new IciciStatementParser.ParsedTransaction(
                LocalDate.of(2026, 2, 1), LocalDate.of(2026, 2, 1), null,
                "OLA CAB BOOKING", BigDecimal.TEN, BigDecimal.ZERO, BigDecimal.valueOf(500));

        IciciStatementParser.ParsedStatement statement = new IciciStatementParser.ParsedStatement(
                "ICICI", "XXXX9999", "OMPRAKASH HARISH", "SAVINGS", List.of(tx));

        MultipartFile file = new MockMultipartFile(
                "files", "statement2.xls", "application/vnd.ms-excel", new byte[]{1, 2, 3});

        ImportBatch savedBatch = buildBatch(BATCH_ID);

        when(parser.parse(file)).thenReturn(statement);
        when(bankAccountService.findOrCreate(any(), any(), any(), any())).thenReturn(account);
        when(importBatchRepository.save(any())).thenReturn(savedBatch);
        when(transactionRepository.existsByImportHash(any())).thenReturn(false);
        when(categorizationService.categorize(any(), any())).thenReturn(transport);
        when(merchantExtractor.extract(any())).thenReturn("Ola");

        ImportResultDto.Response response = importService.importFiles(USER_ID, List.of(file));

        ImportResultDto.FileSummary summary = response.files().get(0);
        assertThat(summary.categorized()).isEqualTo(1);
        assertThat(summary.misc()).isEqualTo(0);
        assertThat(summary.categorizationPct()).isEqualTo(100);
    }

    @Test
    void importFiles_confidenceScore_zeroTransactions() throws Exception {
        BankAccount account = new BankAccount();
        account.setId(UUID.randomUUID());
        account.setBankName("ICICI");
        account.setAccountNumberMasked("XXXX0000");

        IciciStatementParser.ParsedStatement statement = new IciciStatementParser.ParsedStatement(
                "ICICI", "XXXX0000", "OMPRAKASH HARISH", "SAVINGS", List.of());

        MultipartFile file = new MockMultipartFile(
                "files", "empty.xls", "application/vnd.ms-excel", new byte[]{1, 2, 3});

        ImportBatch savedBatch = buildBatch(BATCH_ID);

        when(parser.parse(file)).thenReturn(statement);
        when(bankAccountService.findOrCreate(any(), any(), any(), any())).thenReturn(account);
        when(importBatchRepository.save(any())).thenReturn(savedBatch);

        ImportResultDto.Response response = importService.importFiles(USER_ID, List.of(file));

        ImportResultDto.FileSummary summary = response.files().get(0);
        assertThat(summary.categorized()).isEqualTo(0);
        assertThat(summary.misc()).isEqualTo(0);
        assertThat(summary.categorizationPct()).isEqualTo(0);
    }
}
