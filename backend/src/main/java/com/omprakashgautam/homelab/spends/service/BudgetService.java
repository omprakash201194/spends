package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.BudgetDto;
import com.omprakashgautam.homelab.spends.model.Budget;
import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.BudgetRepository;
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BudgetService {

    private final BudgetRepository budgetRepository;
    private final CategoryRepository categoryRepository;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    private static final DateTimeFormatter MONTH_HEADER = DateTimeFormatter.ofPattern("MMMM yyyy");

    @Transactional(readOnly = true)
    public BudgetDto.MonthSummary getMonthSummary(UUID userId) {
        LocalDate anchor = resolveAnchorMonth(userId);
        LocalDate from   = anchor.withDayOfMonth(1);
        LocalDate to     = anchor.withDayOfMonth(anchor.lengthOfMonth());
        int year         = anchor.getYear();
        int month        = anchor.getMonthValue();

        // Spending per category this month
        Map<String, BigDecimal> spentByCategory = transactionRepository
                .categoryBreakdown(userId, from, to)
                .stream()
                .collect(Collectors.toMap(
                        row -> (String) row[0],
                        row -> (BigDecimal) row[2]
                ));

        // Existing budgets this month, keyed by category id
        Map<UUID, Budget> budgetByCategory = budgetRepository
                .findByUserIdAndYearAndMonth(userId, year, month)
                .stream()
                .collect(Collectors.toMap(b -> b.getCategory().getId(), b -> b));

        List<Category> categories = categoryRepository.findAll();
        List<BudgetDto.CategoryBudget> items = categories.stream()
                .map(cat -> {
                    BigDecimal spent = spentByCategory.getOrDefault(cat.getName(), BigDecimal.ZERO);
                    Budget budget = budgetByCategory.get(cat.getId());
                    BigDecimal limit = budget != null ? budget.getAmount() : null;
                    int pct = 0;
                    if (limit != null && limit.compareTo(BigDecimal.ZERO) > 0) {
                        pct = spent.multiply(BigDecimal.valueOf(100))
                                .divide(limit, 0, RoundingMode.HALF_UP)
                                .intValue();
                    }
                    return new BudgetDto.CategoryBudget(
                            budget != null ? budget.getId() : null,
                            cat.getId(),
                            cat.getName(),
                            cat.getColor(),
                            limit,
                            spent,
                            pct
                    );
                })
                // Sort: categories with spending or a budget first, then alphabetically
                .sorted((a, b) -> {
                    boolean aActive = a.spent().compareTo(BigDecimal.ZERO) > 0 || a.limit() != null;
                    boolean bActive = b.spent().compareTo(BigDecimal.ZERO) > 0 || b.limit() != null;
                    if (aActive != bActive) return aActive ? -1 : 1;
                    return a.categoryName().compareTo(b.categoryName());
                })
                .toList();

        return new BudgetDto.MonthSummary(anchor.format(MONTH_HEADER), year, month, items);
    }

    @Transactional
    public BudgetDto.CategoryBudget setBudget(UUID userId, BudgetDto.SetRequest req) {
        User user = userRepository.getReferenceById(userId);
        Category category = categoryRepository.findById(req.categoryId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));

        Budget budget = budgetRepository
                .findByUserIdAndCategoryIdAndYearAndMonth(userId, req.categoryId(), req.year(), req.month())
                .orElseGet(() -> Budget.builder()
                        .user(user)
                        .category(category)
                        .year(req.year())
                        .month(req.month())
                        .build());

        budget.setAmount(req.limit());
        Budget saved = budgetRepository.save(budget);

        LocalDate anchor = LocalDate.of(req.year(), req.month(), 1);
        LocalDate from   = anchor.withDayOfMonth(1);
        LocalDate to     = anchor.withDayOfMonth(anchor.lengthOfMonth());

        BigDecimal spent = transactionRepository
                .categoryBreakdown(userId, from, to)
                .stream()
                .filter(row -> category.getName().equals(row[0]))
                .map(row -> (BigDecimal) row[2])
                .findFirst()
                .orElse(BigDecimal.ZERO);

        int pct = 0;
        if (req.limit().compareTo(BigDecimal.ZERO) > 0) {
            pct = spent.multiply(BigDecimal.valueOf(100))
                    .divide(req.limit(), 0, RoundingMode.HALF_UP)
                    .intValue();
        }

        return new BudgetDto.CategoryBudget(
                saved.getId(), category.getId(), category.getName(), category.getColor(),
                req.limit(), spent, pct
        );
    }

    @Transactional
    public void deleteBudget(UUID userId, UUID budgetId) {
        Budget budget = budgetRepository.findById(budgetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Budget not found"));
        if (!budget.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        budgetRepository.delete(budget);
    }

    private LocalDate resolveAnchorMonth(UUID userId) {
        LocalDate latest = transactionRepository.latestTransactionDate(userId);
        return latest != null ? latest : LocalDate.now();
    }
}
