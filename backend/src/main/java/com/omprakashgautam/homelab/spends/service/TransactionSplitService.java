package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.TransactionSplitDto;
import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.Transaction;
import com.omprakashgautam.homelab.spends.model.TransactionSplit;
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionSplitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TransactionSplitService {

    private final TransactionSplitRepository transactionSplitRepository;
    private final TransactionRepository transactionRepository;
    private final CategoryRepository categoryRepository;

    @Transactional(readOnly = true)
    public List<TransactionSplitDto.Response> getSplits(UUID transactionId) {
        return transactionSplitRepository.findByTransactionId(transactionId).stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional
    public List<TransactionSplitDto.Response> saveSplits(UUID transactionId,
                                                          List<TransactionSplitDto.SplitItem> items) {
        Transaction tx = transactionRepository.findById(transactionId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        transactionSplitRepository.deleteByTransactionId(transactionId);

        List<TransactionSplit> splits = items.stream().map(item -> {
            Category cat = null;
            if (item.categoryId() != null) {
                cat = categoryRepository.findById(item.categoryId()).orElse(null);
            }
            return TransactionSplit.builder()
                .transaction(tx)
                .category(cat)
                .amount(item.amount())
                .note(item.note())
                .build();
        }).toList();

        return transactionSplitRepository.saveAll(splits).stream()
            .map(this::toResponse)
            .toList();
    }

    private TransactionSplitDto.Response toResponse(TransactionSplit s) {
        return new TransactionSplitDto.Response(
            s.getId(),
            s.getCategory() != null ? s.getCategory().getId() : null,
            s.getCategory() != null ? s.getCategory().getName() : null,
            s.getAmount(),
            s.getNote()
        );
    }
}
