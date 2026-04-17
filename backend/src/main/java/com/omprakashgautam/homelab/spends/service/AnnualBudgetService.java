package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.AnnualBudgetDto;
import com.omprakashgautam.homelab.spends.model.AnnualBudget;
import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.AnnualBudgetRepository;
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AnnualBudgetService {

    private final AnnualBudgetRepository annualBudgetRepository;
    private final CategoryRepository categoryRepository;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<AnnualBudgetDto.Response> getAnnualSummary(UUID userId, int year) {
        return annualBudgetRepository.findByUserIdAndYear(userId, year).stream()
            .map(ab -> {
                BigDecimal spent = transactionRepository.sumWithdrawalsForCategoryAndYear(
                    userId, ab.getCategory().getId(), year);
                return new AnnualBudgetDto.Response(
                    ab.getId(),
                    ab.getCategory().getId(),
                    ab.getCategory().getName(),
                    ab.getCategory().getIcon(),
                    year,
                    ab.getAmount(),
                    spent);
            })
            .toList();
    }

    @Transactional
    public AnnualBudgetDto.Response setAnnualBudget(UUID userId, AnnualBudgetDto.SetRequest req) {
        User user = userRepository.getReferenceById(userId);
        Category cat = categoryRepository.findById(req.categoryId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));

        AnnualBudget ab = annualBudgetRepository
            .findByUserIdAndCategoryIdAndYear(userId, req.categoryId(), req.year())
            .orElseGet(() -> AnnualBudget.builder()
                .user(user)
                .category(cat)
                .year(req.year())
                .build());

        ab.setAmount(req.amount());
        ab = annualBudgetRepository.save(ab);

        BigDecimal spent = transactionRepository.sumWithdrawalsForCategoryAndYear(
            userId, cat.getId(), req.year());

        return new AnnualBudgetDto.Response(
            ab.getId(), cat.getId(), cat.getName(), cat.getIcon(),
            req.year(), ab.getAmount(), spent);
    }

    @Transactional
    public void deleteAnnualBudget(UUID userId, UUID id) {
        AnnualBudget ab = annualBudgetRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Annual budget not found"));
        if (!ab.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        annualBudgetRepository.delete(ab);
    }
}
