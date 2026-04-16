package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.ReportDto;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final TransactionRepository transactionRepository;

    private static final DateTimeFormatter MONTH_LABEL = DateTimeFormatter.ofPattern("MMMM yyyy");

    @Transactional(readOnly = true)
    public List<Integer> getAvailableYears(UUID userId) {
        List<Integer> years = transactionRepository.availableYears(userId);
        return years.isEmpty() ? List.of(LocalDate.now().getYear()) : years;
    }

    @Transactional(readOnly = true)
    public ReportDto.YearSummary getMonthlySummary(UUID userId, int year) {
        LocalDate from = LocalDate.of(year, 1, 1);
        LocalDate to   = LocalDate.of(year, 12, 31);

        // monthlyTrend returns [yearMonth, sumWithdrawal, sumDeposit] for all months >= from
        List<Object[]> trendRows = transactionRepository.monthlyTrend(userId, from);
        Map<String, Object[]> trendByYM = new HashMap<>();
        for (Object[] row : trendRows) {
            String ym = (String) row[0];
            // Only keep rows that belong to the requested year
            if (ym.startsWith(year + "-")) {
                trendByYM.put(ym, row);
            }
        }

        // categorySpendByMonth returns [yearMonth, categoryName, categoryColor, sumWithdrawal]
        List<Object[]> catRows = transactionRepository.categorySpendByMonth(userId, from, to);
        Map<String, List<ReportDto.CategoryRow>> catsByYM = new HashMap<>();
        for (Object[] row : catRows) {
            String ym = (String) row[0];
            catsByYM.computeIfAbsent(ym, k -> new ArrayList<>())
                    .add(new ReportDto.CategoryRow(
                            (String) row[1],
                            (String) row[2],
                            (BigDecimal) row[3]
                    ));
        }

        List<ReportDto.MonthRow> months = new ArrayList<>(12);
        BigDecimal grandSpent  = BigDecimal.ZERO;
        BigDecimal grandIncome = BigDecimal.ZERO;

        for (int m = 1; m <= 12; m++) {
            String ym = String.format("%d-%02d", year, m);
            String label = LocalDate.of(year, m, 1).format(MONTH_LABEL);

            Object[] trend  = trendByYM.get(ym);
            BigDecimal spent  = trend != null ? (BigDecimal) trend[1] : BigDecimal.ZERO;
            BigDecimal income = trend != null ? (BigDecimal) trend[2] : BigDecimal.ZERO;
            BigDecimal net    = income.subtract(spent);

            List<ReportDto.CategoryRow> cats = catsByYM.getOrDefault(ym, List.of());

            months.add(new ReportDto.MonthRow(ym, label, spent, income, net, cats));
            grandSpent  = grandSpent.add(spent);
            grandIncome = grandIncome.add(income);
        }

        return new ReportDto.YearSummary(year, months, grandSpent, grandIncome);
    }
}
