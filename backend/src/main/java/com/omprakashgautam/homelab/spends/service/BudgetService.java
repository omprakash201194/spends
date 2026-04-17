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
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
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

    private record CategorySpendRow(UUID categoryId, String name, String color, BigDecimal spent) {}

    @Transactional(readOnly = true)
    public BudgetDto.MonthSummary getMonthSummary(UUID userId) {
        LocalDate anchor = resolveAnchorMonth(userId);
        LocalDate from   = anchor.withDayOfMonth(1);
        LocalDate to     = anchor.withDayOfMonth(anchor.lengthOfMonth());
        int year         = anchor.getYear();
        int month        = anchor.getMonthValue();

        // Spending per category this month (rolled up to root categories)
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "User not found"));
        List<Category> allCats = categoryRepository.findBySystemTrueOrHouseholdId(user.getHousehold().getId());
        List<CategorySpendRow> rawRows = transactionRepository.categoryBreakdown(userId, from, to)
                .stream()
                .map(row -> new CategorySpendRow((UUID) row[0], (String) row[1], (String) row[2], (BigDecimal) row[3]))
                .toList();
        Map<UUID, BigDecimal> spentById = rollupToRoots(rawRows, allCats).stream()
                .collect(Collectors.toMap(CategorySpendRow::categoryId, CategorySpendRow::spent));

        // Existing budgets this month, keyed by category id
        Map<UUID, Budget> budgetByCategory = budgetRepository
                .findByUserIdAndYearAndMonth(userId, year, month)
                .stream()
                .collect(Collectors.toMap(b -> b.getCategory().getId(), b -> b));

        // Previous month date range (for rollover calculation)
        YearMonth prevYearMonth = YearMonth.of(year, month).minusMonths(1);
        LocalDate prevFrom = prevYearMonth.atDay(1);
        LocalDate prevTo   = prevYearMonth.atEndOfMonth();

        List<BudgetDto.CategoryBudget> items = allCats.stream()
                .map(cat -> {
                    BigDecimal spent = spentById.getOrDefault(cat.getId(), BigDecimal.ZERO);
                    Budget budget = budgetByCategory.get(cat.getId());
                    BigDecimal limit = budget != null ? budget.getAmount() : null;

                    // Compute effective limit (adds unspent from previous month when rollover=true)
                    BigDecimal effectiveLimit = limit;
                    if (limit != null && budget.isRollover()) {
                        BigDecimal prevSpent = transactionRepository.sumWithdrawalsForCategory(
                                userId, cat.getName(), prevFrom, prevTo);
                        BigDecimal unspent = limit.subtract(prevSpent).max(BigDecimal.ZERO);
                        effectiveLimit = limit.add(unspent);
                    }

                    int pct = 0;
                    if (effectiveLimit != null && effectiveLimit.compareTo(BigDecimal.ZERO) > 0) {
                        pct = spent.multiply(BigDecimal.valueOf(100))
                                .divide(effectiveLimit, 0, RoundingMode.HALF_UP)
                                .intValue();
                    }
                    return new BudgetDto.CategoryBudget(
                            budget != null ? budget.getId() : null,
                            cat.getId(),
                            cat.getName(),
                            cat.getColor(),
                            limit,
                            effectiveLimit,
                            spent,
                            pct,
                            budget != null && budget.isRollover()
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
        budget.setRollover(req.rollover());
        Budget saved = budgetRepository.save(budget);

        LocalDate anchor = LocalDate.of(req.year(), req.month(), 1);
        LocalDate from   = anchor.withDayOfMonth(1);
        LocalDate to     = anchor.withDayOfMonth(anchor.lengthOfMonth());

        BigDecimal spent = transactionRepository
                .categoryBreakdown(userId, from, to)
                .stream()
                .filter(row -> category.getId().equals(row[0]))
                .map(row -> (BigDecimal) row[3])
                .findFirst()
                .orElse(BigDecimal.ZERO);

        // Compute effective limit for the response
        BigDecimal effectiveLimit = req.limit();
        if (req.rollover()) {
            YearMonth prevYM = YearMonth.of(req.year(), req.month()).minusMonths(1);
            BigDecimal prevSpent = transactionRepository.sumWithdrawalsForCategory(
                    userId, category.getName(), prevYM.atDay(1), prevYM.atEndOfMonth());
            BigDecimal unspent = req.limit().subtract(prevSpent).max(BigDecimal.ZERO);
            effectiveLimit = req.limit().add(unspent);
        }

        int pct = 0;
        if (effectiveLimit.compareTo(BigDecimal.ZERO) > 0) {
            pct = spent.multiply(BigDecimal.valueOf(100))
                    .divide(effectiveLimit, 0, RoundingMode.HALF_UP)
                    .intValue();
        }

        return new BudgetDto.CategoryBudget(
                saved.getId(), category.getId(), category.getName(), category.getColor(),
                req.limit(), effectiveLimit, spent, pct, req.rollover()
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

    private static List<CategorySpendRow> rollupToRoots(List<CategorySpendRow> rows, List<Category> allCats) {
        Map<UUID, BigDecimal> rolledUp = new LinkedHashMap<>();
        for (CategorySpendRow row : rows) {
            List<UUID> ancestors = CategoryTreeUtils.getAncestorIds(row.categoryId(), allCats);
            if (ancestors.isEmpty()) {
                rolledUp.merge(row.categoryId(), row.spent(), BigDecimal::add);
            } else {
                UUID rootId = ancestors.get(ancestors.size() - 1);
                rolledUp.merge(rootId, row.spent(), BigDecimal::add);
            }
        }
        Map<UUID, Category> catById = allCats.stream()
                .collect(Collectors.toMap(Category::getId, c -> c, (a, b) -> a));
        return rolledUp.entrySet().stream()
                .filter(e -> e.getValue().compareTo(BigDecimal.ZERO) > 0)
                .map(e -> {
                    Category cat = catById.get(e.getKey());
                    String name = cat != null ? cat.getName() : "Unknown";
                    String color = cat != null ? cat.getColor() : "#94a3b8";
                    return new CategorySpendRow(e.getKey(), name, color, e.getValue());
                })
                .sorted(java.util.Comparator.comparing(CategorySpendRow::spent).reversed())
                .toList();
    }

    private LocalDate resolveAnchorMonth(UUID userId) {
        LocalDate latest = transactionRepository.latestTransactionDate(userId);
        return latest != null ? latest : LocalDate.now();
    }
}
