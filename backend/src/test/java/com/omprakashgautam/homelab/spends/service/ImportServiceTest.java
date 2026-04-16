package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.ImportBatchDto;
import com.omprakashgautam.homelab.spends.model.BankAccount;
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
import org.springframework.web.server.ResponseStatusException;

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
}
