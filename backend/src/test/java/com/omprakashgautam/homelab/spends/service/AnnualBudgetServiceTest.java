package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.AnnualBudgetDto;
import com.omprakashgautam.homelab.spends.model.AnnualBudget;
import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.AnnualBudgetRepository;
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AnnualBudgetServiceTest {

    @Mock AnnualBudgetRepository annualBudgetRepository;
    @Mock CategoryRepository categoryRepository;
    @Mock TransactionRepository transactionRepository;
    @Mock UserRepository userRepository;
    @InjectMocks AnnualBudgetService annualBudgetService;

    @Test
    void getAnnualSummary_returnsSpentVsBudget() {
        UUID userId = UUID.randomUUID();
        UUID categoryId = UUID.randomUUID();

        User user = User.builder().id(userId).build();
        Category cat = Category.builder().id(categoryId).name("Food").icon("🍕").build();

        AnnualBudget ab = AnnualBudget.builder()
            .id(UUID.randomUUID()).user(user).category(cat)
            .year(2024).amount(new BigDecimal("12000")).build();

        when(annualBudgetRepository.findByUserIdAndYear(userId, 2024)).thenReturn(List.of(ab));
        when(transactionRepository.sumWithdrawalsForCategoryAndYear(userId, categoryId, 2024))
            .thenReturn(new BigDecimal("9000"));

        List<AnnualBudgetDto.Response> result = annualBudgetService.getAnnualSummary(userId, 2024);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).spent()).isEqualByComparingTo("9000");
        assertThat(result.get(0).amount()).isEqualByComparingTo("12000");
        assertThat(result.get(0).categoryName()).isEqualTo("Food");
    }
}
