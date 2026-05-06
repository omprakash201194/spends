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
    private static final DateTimeFormatter YEAR_MONTH   = DateTimeFormatter.ofPattern("yyyy-MM");
    private static final LocalDate EPOCH = LocalDate.of(2000, 1, 1);

    private record CategorySpendRow(UUID categoryId, String name, String color, BigDecimal spent) {}

    // ── Lifetime overview ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public DashboardDto.Lifetime getLifetime(UUID userId) {
        LocalDate today = LocalDate.now();
        LocalDate earliest = transactionRepository.earliestDate(userId);
        LocalDate latest   = transactionRepository.latestTransactionDate(userId);

        // Use a wide range so existing aggregate queries can be reused for lifetime sums.
        LocalDate from = earliest != null ? earliest : EPOCH;
        LocalDate to   = latest   != null ? latest   : today;

        long count = transactionRepository.countByUserId(userId);
        BigDecimal withdrawals = transactionRepository.sumWithdrawals(userId, from, to);
        BigDecimal deposits    = transactionRepository.sumDeposits(userId, from, to);
        BigDecimal totalAmount = withdrawals.add(deposits);

        DashboardDto.LifetimeSummary summary = new DashboardDto.LifetimeSummary(
                count, totalAmount, withdrawals, deposits, earliest, latest
        );

        // Categories — same rollup-to-roots logic the month dashboard uses
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "User not found"));
        List<Category> allCats = categoryRepository.findBySystemTrueOrHouseholdId(user.getHousehold().getId());
        List<CategorySpendRow> rawRows = transactionRepository.categoryBreakdown(userId, from, to).stream()
                .map(row -> new CategorySpendRow((UUID) row[0], (String) row[1], (String) row[2], (BigDecimal) row[3]))
                .toList();
        List<DashboardDto.CategoryAmount> categories = rollupToRoots(rawRows, allCats).stream()
                .map(r -> new DashboardDto.CategoryAmount(r.name(), r.color(), r.spent()))
                .toList();

        // Banks
        List<DashboardDto.BankActivity> banks = transactionRepository.bankBreakdown(userId).stream()
                .map(row -> new DashboardDto.BankActivity(
                        (String) row[0],
                        (BigDecimal) row[1],
                        ((Number) row[2]).longValue()))
                .toList();

        // Monthly trend — last 24 months anchored on the most recent month with data
        LocalDate trendAnchor = latest != null ? latest : today;
        LocalDate trendFrom   = trendAnchor.minusMonths(23).withDayOfMonth(1);
        List<DashboardDto.MonthlyPoint> trend = buildMonthlyPoints(
                transactionRepository.monthlyTrend(userId, trendFrom),
                trendFrom, trendAnchor
        );

        // Yearly
        List<DashboardDto.YearlyPoint> yearly = transactionRepository.yearlySpending(userId).stream()
                .map(row -> new DashboardDto.YearlyPoint(
                        ((Number) row[0]).intValue(),
                        (BigDecimal) row[1]))
                .toList();

        return new DashboardDto.Lifetime(summary, categories, banks, trend, yearly);
    }

    /**
     * Builds a contiguous monthly series from `start` to `end` (inclusive of both
     * months), zero-filling months with no transactions. Row layout from the
     * underlying query: [yyyy-MM, withdrawals, deposits].
     */
    private List<DashboardDto.MonthlyPoint> buildMonthlyPoints(
            List<Object[]> rows, LocalDate start, LocalDate end) {
        var byYearMonth = new java.util.HashMap<String, Object[]>();
        for (Object[] row : rows) {
            byYearMonth.put((String) row[0], row);
        }
        List<DashboardDto.MonthlyPoint> result = new ArrayList<>();
        LocalDate cursor = start.withDayOfMonth(1);
        LocalDate stop   = end.withDayOfMonth(1);
        while (!cursor.isAfter(stop)) {
            String key = cursor.format(YEAR_MONTH);
            Object[] row = byYearMonth.get(key);
            BigDecimal w = row != null ? (BigDecimal) row[1] : BigDecimal.ZERO;
            BigDecimal d = row != null ? (BigDecimal) row[2] : BigDecimal.ZERO;
            result.add(new DashboardDto.MonthlyPoint(key, w, d));
            cursor = cursor.plusMonths(1);
        }
        return result;
    }

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
