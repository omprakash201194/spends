package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.TransactionDto;
import com.omprakashgautam.homelab.spends.model.BankAccount;
import com.omprakashgautam.homelab.spends.model.Transaction;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
import com.omprakashgautam.homelab.spends.repository.CategoryRuleRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransactionServiceTest {

    @Mock TransactionRepository   transactionRepository;
    @Mock CategoryRepository      categoryRepository;
    @Mock CategoryRuleRepository  categoryRuleRepository;
    @Mock UserRepository          userRepository;

    @InjectMocks TransactionService transactionService;

    @Test
    void updateNote_setsNoteAndReturns() {
        UUID userId = UUID.randomUUID();
        User owner = User.builder().id(userId).build();
        BankAccount account = BankAccount.builder()
                .id(UUID.randomUUID())
                .bankName("Test Bank")
                .user(owner)
                .build();
        Transaction tx = Transaction.builder()
                .id(UUID.randomUUID())
                .bankAccount(account)
                .rawRemarks("test")
                .withdrawalAmount(BigDecimal.ZERO)
                .depositAmount(BigDecimal.ZERO)
                .reviewed(false)
                .build();
        when(transactionRepository.findById(tx.getId())).thenReturn(Optional.of(tx));
        when(transactionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        TransactionDto.Response result = transactionService.updateNote(tx.getId(), userId, "my note");

        assertThat(result.note()).isEqualTo("my note");
        assertThat(tx.getNote()).isEqualTo("my note");
    }

    @Test
    void updateNote_throwsForbidden_whenTransactionBelongsToDifferentUser() {
        UUID ownerId = UUID.randomUUID();
        UUID attackerId = UUID.randomUUID();
        User owner = User.builder().id(ownerId).build();
        BankAccount account = BankAccount.builder()
                .id(UUID.randomUUID())
                .bankName("Test Bank")
                .user(owner)
                .build();
        Transaction tx = Transaction.builder()
                .id(UUID.randomUUID())
                .bankAccount(account)
                .rawRemarks("test")
                .withdrawalAmount(BigDecimal.ZERO)
                .depositAmount(BigDecimal.ZERO)
                .reviewed(false)
                .build();
        when(transactionRepository.findById(tx.getId())).thenReturn(Optional.of(tx));

        assertThatThrownBy(() -> transactionService.updateNote(tx.getId(), attackerId, "hacked"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }
}
