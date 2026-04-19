package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.DashboardDto;
import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final TransactionRepository transactionRepository;
    private final CategoryRepository categoryRepository;
    private final UserRepository userRepository;

    private static final DateTimeFormatter MONTH_LABEL  = DateTimeFormatter.ofPattern("MMM");
    private static final DateTimeFormatter MONTH_HEADER = DateTimeFormatter.ofPattern("MMMM yyyy");

    private record CategorySpendRow(UUID categoryId, String name, String color, BigDecimal spent) {}

    @Transactional(readOnly = true)
    public DashboardDto.Summary getSummary(UUID userId, UUID accountId) {
        LocalDate anchor  = resolveAnchorMonth(userId, accountId);
        LocalDate from    = anchor.withDayOfMonth(1);
        LocalDate to      = anchor.withDayOfMonth(anchor.lengthOfMonth());
        LocalDate trend12 = anchor.minusMonths(11).withDayOfMonth(1);

        BigDecimal spent  = accountId != null
                ? transactionRepository.sumWithdrawalsFiltered(userId, from, to, accountId)
                : transactionRepository.sumWithdrawals(userId, from, to);
        BigDecimal income = accountId != null
                ? transactionRepository.sumDepositsFiltered(userId, from, to, accountId)
                : transactionRepository.sumDeposits(userId, from, to);
        long count        = accountId != null
                ? transactionRepository.countInPeriodFiltered(userId, from, to, accountId)
                : transactionRepository.countInPeriod(userId, from, to);
        BigDecimal net    = income.subtract(spent);

        LocalDate prevMonthDate = anchor.minusMonths(1);
        LocalDate prevMonthFrom = prevMonthDate.withDayOfMonth(1);
        LocalDate prevMonthTo   = prevMonthDate.withDayOfMonth(prevMonthDate.lengthOfMonth());
        DashboardDto.Comparison prevMonth = new DashboardDto.Comparison(
                accountId != null
                        ? transactionRepository.sumWithdrawalsFiltered(userId, prevMonthFrom, prevMonthTo, accountId)
                        : transactionRepository.sumWithdrawals(userId, prevMonthFrom, prevMonthTo),
                accountId != null
                        ? transactionRepository.sumDepositsFiltered(userId, prevMonthFrom, prevMonthTo, accountId)
                        : transactionRepository.sumDeposits(userId, prevMonthFrom, prevMonthTo),
                accountId != null
                        ? transactionRepository.countInPeriodFiltered(userId, prevMonthFrom, prevMonthTo, accountId)
                        : transactionRepository.countInPeriod(userId, prevMonthFrom, prevMonthTo)
        );

        LocalDate prevYearDate = anchor.minusYears(1);
        LocalDate prevYearFrom = prevYearDate.withDayOfMonth(1);
        LocalDate prevYearTo   = prevYearDate.withDayOfMonth(prevYearDate.lengthOfMonth());
        DashboardDto.Comparison prevYear = new DashboardDto.Comparison(
                accountId != null
                        ? transactionRepository.sumWithdrawalsFiltered(userId, prevYearFrom, prevYearTo, accountId)
                        : transactionRepository.sumWithdrawals(userId, prevYearFrom, prevYearTo),
                accountId != null
                        ? transactionRepository.sumDepositsFiltered(userId, prevYearFrom, prevYearTo, accountId)
                        : transactionRepository.sumDeposits(userId, prevYearFrom, prevYearTo),
                accountId != null
                        ? transactionRepository.countInPeriodFiltered(userId, prevYearFrom, prevYearTo, accountId)
                        : transactionRepository.countInPeriod(userId, prevYearFrom, prevYearTo)
        );

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "User not found"));
        List<Category> allCats = categoryRepository.findBySystemTrueOrHouseholdId(user.getHousehold().getId());

        List<CategorySpendRow> rawRows = (accountId != null
                ? transactionRepository.categoryBreakdownFiltered(userId, from, to, accountId)
                : transactionRepository.categoryBreakdown(userId, from, to))
                .stream()
                .map(row -> new CategorySpendRow((UUID) row[0], (String) row[1], (String) row[2], (BigDecimal) row[3]))
                .toList();

        List<DashboardDto.CategoryStat> categories = rollupToRoots(rawRows, allCats)
                .stream()
                .map(r -> new DashboardDto.CategoryStat(r.name(), r.color(), r.spent()))
                .toList();

        List<DashboardDto.MonthlyTrend> trend = buildTrend(
                accountId != null
                        ? transactionRepository.monthlyTrendFiltered(userId, trend12, accountId)
                        : transactionRepository.monthlyTrend(userId, trend12),
                trend12, anchor
        );

        List<DashboardDto.MerchantStat> merchants = (accountId != null
                ? transactionRepository.topMerchantsFiltered(userId, from, to, accountId)
                : transactionRepository.topMerchants(userId, from, to))
                .stream()
                .map(row -> new DashboardDto.MerchantStat(
                        (String) row[0],
                        (BigDecimal) row[1],
                        (Long) row[2]
                ))
                .toList();

        return new DashboardDto.Summary(
                anchor.format(MONTH_HEADER),
                spent, income, net, count,
                categories, trend, merchants,
                prevMonth, prevYear
        );
    }

    /**
     * Returns the most recent month with data for this user (optionally scoped to one account).
     * Falls back to the current calendar month if no data exists yet.
     */
    private LocalDate resolveAnchorMonth(UUID userId, UUID accountId) {
        LocalDate latest = accountId != null
                ? transactionRepository.latestTransactionDateFiltered(userId, accountId)
                : transactionRepository.latestTransactionDate(userId);
        return latest != null ? latest : LocalDate.now();
    }

    /**
     * Builds a full 12-month list, filling zeroes for months with no transactions.
     */
    private List<DashboardDto.MonthlyTrend> buildTrend(
            List<Object[]> rows, LocalDate start, LocalDate end) {

        var byYearMonth = new java.util.HashMap<String, Object[]>();
        for (Object[] row : rows) {
            byYearMonth.put((String) row[0], row);
        }

        List<DashboardDto.MonthlyTrend> result = new ArrayList<>();
        LocalDate cursor = start;

        while (!cursor.isAfter(end)) {
            String key   = cursor.format(DateTimeFormatter.ofPattern("yyyy-MM"));
            String label = cursor.format(MONTH_LABEL);

            Object[] row = byYearMonth.get(key);
            BigDecimal s = row != null ? (BigDecimal) row[1] : BigDecimal.ZERO;
            BigDecimal i = row != null ? (BigDecimal) row[2] : BigDecimal.ZERO;

            result.add(new DashboardDto.MonthlyTrend(label, key, s, i));
            cursor = cursor.plusMonths(1);
        }

        return result;
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
}
