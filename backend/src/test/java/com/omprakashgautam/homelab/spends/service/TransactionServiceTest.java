package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.TransactionDto;
import com.omprakashgautam.homelab.spends.model.BankAccount;
import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.Household;
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
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
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

    @Test
    void bulkUpdateCategory_updatesAllAndReturnsCount() {
        UUID catId = UUID.randomUUID();
        Category cat = Category.builder().id(catId).name("Food").build();
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).build();

        List<UUID> txIds = List.of(UUID.randomUUID(), UUID.randomUUID());
        BankAccount account = BankAccount.builder().user(user).build();
        List<Transaction> txs = txIds.stream()
                .map(id -> Transaction.builder().id(id).rawRemarks("r")
                        .bankAccount(account)
                        .withdrawalAmount(BigDecimal.ZERO).depositAmount(BigDecimal.ZERO)
                        .reviewed(false).build())
                .collect(Collectors.toList());

        when(userRepository.getReferenceById(userId)).thenReturn(user);
        when(transactionRepository.findAllByIdInAndBankAccountUser(txIds, user)).thenReturn(txs);
        when(categoryRepository.findById(catId)).thenReturn(Optional.of(cat));
        when(transactionRepository.saveAll(any())).thenAnswer(i -> i.getArgument(0));

        int count = transactionService.bulkUpdateCategory(txIds, catId, userId);

        assertThat(count).isEqualTo(2);
        txs.forEach(tx -> assertThat(tx.getCategory()).isEqualTo(cat));
    }

    @Test
    void list_withCategoryFilter_expandsToIncludeDescendants() {
        UUID userId = UUID.randomUUID();
        UUID householdId = UUID.randomUUID();
        UUID foodId = UUID.randomUUID();
        UUID swiggyId = UUID.randomUUID();

        Category food   = Category.builder().id(foodId).name("Food").system(true).build();
        Category swiggy = Category.builder().id(swiggyId).name("Swiggy").system(false).parent(food).build();

        User user = User.builder().id(userId)
                .household(Household.builder().id(householdId).name("H").inviteCode("X").maxCategoryDepth(5).build())
                .build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(categoryRepository.findBySystemTrueOrHouseholdId(householdId))
                .thenReturn(List.of(food, swiggy));
        when(transactionRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class),
                any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(org.springframework.data.domain.Page.empty());

        // Filter by parent "foodId" — should expand to include swiggyId
        transactionService.list(userId, null, foodId, null, null, null, null, 0, 25, null, null);

        verify(transactionRepository).findAll(
                any(org.springframework.data.jpa.domain.Specification.class),
                any(org.springframework.data.domain.Pageable.class));
        verify(categoryRepository).findBySystemTrueOrHouseholdId(householdId);
    }
}
