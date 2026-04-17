package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.TransactionSplitDto;
import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.Transaction;
import com.omprakashgautam.homelab.spends.model.TransactionSplit;
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionSplitRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TransactionSplitServiceTest {

    @Mock TransactionSplitRepository transactionSplitRepository;
    @Mock TransactionRepository transactionRepository;
    @Mock CategoryRepository categoryRepository;
    @InjectMocks TransactionSplitService transactionSplitService;

    @Test
    void saveSplits_replacesExistingAndReturnsAll() {
        UUID txId = UUID.randomUUID();
        Transaction tx = Transaction.builder().id(txId)
            .withdrawalAmount(new BigDecimal("1000")).depositAmount(BigDecimal.ZERO)
            .reviewed(false).rawRemarks("test").build();

        UUID catId = UUID.randomUUID();
        Category cat = Category.builder().id(catId).name("Food").build();

        when(transactionRepository.findById(txId)).thenReturn(Optional.of(tx));
        doNothing().when(transactionSplitRepository).deleteByTransactionId(txId);
        when(categoryRepository.findById(catId)).thenReturn(Optional.of(cat));
        when(transactionSplitRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        List<TransactionSplitDto.SplitItem> items = List.of(
            new TransactionSplitDto.SplitItem(catId, new BigDecimal("600"), "Groceries"),
            new TransactionSplitDto.SplitItem(null, new BigDecimal("400"), null)
        );

        List<TransactionSplitDto.Response> result = transactionSplitService.saveSplits(txId, items);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).amount()).isEqualByComparingTo("600");
        assertThat(result.get(0).categoryName()).isEqualTo("Food");
        assertThat(result.get(1).categoryId()).isNull();
        verify(transactionSplitRepository).deleteByTransactionId(txId);
    }
}
