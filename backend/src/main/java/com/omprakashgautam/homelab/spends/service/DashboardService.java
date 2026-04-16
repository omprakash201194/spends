package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.DashboardDto;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final TransactionRepository transactionRepository;

    private static final DateTimeFormatter MONTH_LABEL  = DateTimeFormatter.ofPattern("MMM");
    private static final DateTimeFormatter MONTH_HEADER = DateTimeFormatter.ofPattern("MMMM yyyy");

    @Transactional(readOnly = true)
    public DashboardDto.Summary getSummary(UUID userId) {
        LocalDate anchor  = resolveAnchorMonth(userId);
        LocalDate from    = anchor.withDayOfMonth(1);
        LocalDate to      = anchor.withDayOfMonth(anchor.lengthOfMonth());
        LocalDate trend12 = anchor.minusMonths(11).withDayOfMonth(1);

        BigDecimal spent  = transactionRepository.sumWithdrawals(userId, from, to);
        BigDecimal income = transactionRepository.sumDeposits(userId, from, to);
        long count        = transactionRepository.countInPeriod(userId, from, to);
        BigDecimal net    = income.subtract(spent);

        // Previous month (anchor − 1 month)
        LocalDate prevMonthDate = anchor.minusMonths(1);
        LocalDate prevMonthFrom = prevMonthDate.withDayOfMonth(1);
        LocalDate prevMonthTo   = prevMonthDate.withDayOfMonth(prevMonthDate.lengthOfMonth());
        DashboardDto.Comparison prevMonth = new DashboardDto.Comparison(
                transactionRepository.sumWithdrawals(userId, prevMonthFrom, prevMonthTo),
                transactionRepository.sumDeposits(userId, prevMonthFrom, prevMonthTo),
                transactionRepository.countInPeriod(userId, prevMonthFrom, prevMonthTo)
        );

        // Same month last year (anchor − 12 months)
        LocalDate prevYearDate = anchor.minusYears(1);
        LocalDate prevYearFrom = prevYearDate.withDayOfMonth(1);
        LocalDate prevYearTo   = prevYearDate.withDayOfMonth(prevYearDate.lengthOfMonth());
        DashboardDto.Comparison prevYear = new DashboardDto.Comparison(
                transactionRepository.sumWithdrawals(userId, prevYearFrom, prevYearTo),
                transactionRepository.sumDeposits(userId, prevYearFrom, prevYearTo),
                transactionRepository.countInPeriod(userId, prevYearFrom, prevYearTo)
        );

        List<DashboardDto.CategoryStat> categories = transactionRepository
                .categoryBreakdown(userId, from, to)
                .stream()
                .map(row -> new DashboardDto.CategoryStat(
                        (String) row[0],
                        (String) row[1],
                        (BigDecimal) row[2]
                ))
                .toList();

        List<DashboardDto.MonthlyTrend> trend = buildTrend(
                transactionRepository.monthlyTrend(userId, trend12),
                trend12, anchor
        );

        List<DashboardDto.MerchantStat> merchants = transactionRepository
                .topMerchants(userId, from, to)
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
     * Returns the most recent month with data for this user.
     * Falls back to the current calendar month if no data exists yet.
     */
    private LocalDate resolveAnchorMonth(UUID userId) {
        LocalDate latest = transactionRepository.latestTransactionDate(userId);
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
}
