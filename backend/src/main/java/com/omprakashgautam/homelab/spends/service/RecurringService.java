package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.RecurringDto;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RecurringService {

    private final TransactionRepository transactionRepository;

    static final int LOOKBACK_MONTHS = 13;
    static final int MIN_OCCURRENCES = 3;
    /** Max allowed (max-min)/min ratio across monthly amounts. */
    static final BigDecimal VARIANCE_THRESHOLD = new BigDecimal("0.20");

    private static final DateTimeFormatter MONTH_HEADER = DateTimeFormatter.ofPattern("MMMM yyyy");
    private static final DateTimeFormatter YEAR_MONTH_FMT = DateTimeFormatter.ofPattern("yyyy-MM");

    @Transactional(readOnly = true)
    public RecurringDto.RecurringSummary getPatterns(UUID userId) {
        LocalDate anchor = resolveAnchorMonth(userId);
        LocalDate from = anchor.minusMonths(LOOKBACK_MONTHS).withDayOfMonth(1);
        String anchorYM = anchor.format(YEAR_MONTH_FMT);

        List<Object[]> rows = transactionRepository.merchantMonthlyActivity(userId, from);

        // Group rows by merchantName → list of monthly rows
        Map<String, List<Object[]>> byMerchant = new LinkedHashMap<>();
        for (Object[] row : rows) {
            String merchant = (String) row[0];
            byMerchant.computeIfAbsent(merchant, k -> new ArrayList<>()).add(row);
        }

        List<RecurringDto.RecurringPattern> patterns = new ArrayList<>();

        for (Map.Entry<String, List<Object[]>> entry : byMerchant.entrySet()) {
            String merchant = entry.getKey();
            List<Object[]> monthRows = entry.getValue();

            if (monthRows.size() < MIN_OCCURRENCES) continue;

            // All months must be the same direction (all debit OR all credit)
            boolean allDebit  = monthRows.stream().allMatch(r -> ((BigDecimal) r[4]).compareTo(BigDecimal.ZERO) > 0);
            boolean allCredit = monthRows.stream().allMatch(r -> ((BigDecimal) r[5]).compareTo(BigDecimal.ZERO) > 0);
            if (!allDebit && !allCredit) continue;

            // Effective amount per month = the non-zero side
            List<BigDecimal> amounts = monthRows.stream()
                    .map(r -> allDebit ? (BigDecimal) r[4] : (BigDecimal) r[5])
                    .collect(Collectors.toList());

            // Check amount consistency: (max - min) / min ≤ VARIANCE_THRESHOLD
            BigDecimal minAmt = amounts.stream().min(Comparator.naturalOrder()).orElseThrow();
            BigDecimal maxAmt = amounts.stream().max(Comparator.naturalOrder()).orElseThrow();
            if (minAmt.compareTo(BigDecimal.ZERO) <= 0) continue;
            BigDecimal variance = maxAmt.subtract(minAmt).divide(minAmt, 4, RoundingMode.HALF_UP);
            if (variance.compareTo(VARIANCE_THRESHOLD) > 0) continue;

            // Average amount across months
            BigDecimal total = amounts.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal avgAmt = total.divide(BigDecimal.valueOf(amounts.size()), 2, RoundingMode.HALF_UP);

            // Category from first row
            String categoryName  = (String) monthRows.get(0)[1];
            String categoryColor = (String) monthRows.get(0)[2];

            // Months sorted chronologically
            List<String> months = monthRows.stream()
                    .map(r -> (String) r[3])
                    .sorted()
                    .collect(Collectors.toList());

            String lastMonth    = months.get(months.size() - 1);
            String nextExpected = YearMonth.parse(lastMonth, YEAR_MONTH_FMT)
                    .plusMonths(1)
                    .format(YEAR_MONTH_FMT);
            boolean activeThisMonth = months.contains(anchorYM);

            patterns.add(new RecurringDto.RecurringPattern(
                    merchant, categoryName, categoryColor,
                    RecurringDto.Frequency.MONTHLY,
                    avgAmt, months.size(),
                    lastMonth, nextExpected, activeThisMonth
            ));
        }

        // Sort by average amount descending (highest-value patterns first)
        patterns.sort(Comparator.comparing(RecurringDto.RecurringPattern::averageAmount).reversed());

        return new RecurringDto.RecurringSummary(anchor.format(MONTH_HEADER), patterns);
    }

    private LocalDate resolveAnchorMonth(UUID userId) {
        LocalDate latest = transactionRepository.latestTransactionDate(userId);
        return latest != null ? latest : LocalDate.now();
    }
}
