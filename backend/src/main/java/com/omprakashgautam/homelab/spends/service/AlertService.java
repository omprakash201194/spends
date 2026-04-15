package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.AlertDto;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AlertService {

    private final TransactionRepository transactionRepository;

    private static final BigDecimal LARGE_TX_THRESHOLD  = BigDecimal.valueOf(10_000);
    private static final BigDecimal SPIKE_MIN_AVG       = BigDecimal.valueOf(500);   // ignore tiny categories
    private static final BigDecimal SPIKE_RATIO         = new BigDecimal("1.5");
    private static final int        HISTORY_MONTHS      = 6;
    private static final int        ROLLING_MONTHS      = 3;

    private static final DateTimeFormatter MONTH_HEADER = DateTimeFormatter.ofPattern("MMMM yyyy");
    private static final DateTimeFormatter DAY_MONTH    = DateTimeFormatter.ofPattern("d MMM");

    @Transactional(readOnly = true)
    public AlertDto.AlertSummary getAlerts(UUID userId) {
        LocalDate anchor      = resolveAnchorMonth(userId);
        LocalDate from        = anchor.withDayOfMonth(1);
        LocalDate to          = anchor.withDayOfMonth(anchor.lengthOfMonth());
        LocalDate historyFrom = anchor.minusMonths(HISTORY_MONTHS).withDayOfMonth(1);
        LocalDate rollingFrom = anchor.minusMonths(ROLLING_MONTHS).withDayOfMonth(1);
        LocalDate rollingTo   = from.minusDays(1);

        List<AlertDto.Alert> alerts = new ArrayList<>();

        // ── 1. Large single transactions ──────────────────────────────────────
        for (Object[] row : transactionRepository.findLargeTransactions(userId, from, to, LARGE_TX_THRESHOLD)) {
            String    merchant = (String)    row[0];
            BigDecimal amount  = (BigDecimal) row[1];
            LocalDate  date    = (LocalDate)  row[2];
            String    remarks  = (String)    row[3];

            String title = (merchant != null && !merchant.isBlank())
                    ? merchant
                    : truncate(remarks, 45);

            alerts.add(new AlertDto.Alert(
                    AlertDto.AlertType.LARGE_TRANSACTION,
                    title,
                    "₹" + formatAmount(amount) + " on " + date.format(DAY_MONTH),
                    amount
            ));
        }

        // ── 2. New merchants ──────────────────────────────────────────────────
        for (Object[] row : transactionRepository.findNewMerchantsWithSpend(userId, from, to, historyFrom)) {
            String     merchant = (String)    row[0];
            BigDecimal amount   = (BigDecimal) row[1];
            alerts.add(new AlertDto.Alert(
                    AlertDto.AlertType.NEW_MERCHANT,
                    merchant,
                    "First seen this month",
                    amount
            ));
        }

        // ── 3. Category spikes ────────────────────────────────────────────────
        // Build prior-3-month average per category (missing months treated as 0)
        Map<String, BigDecimal> priorSum = new HashMap<>();
        for (Object[] row : transactionRepository.categorySpendByMonth(userId, rollingFrom, rollingTo)) {
            String     catName = (String)    row[1];
            BigDecimal amount  = (BigDecimal) row[3];
            priorSum.merge(catName, amount, BigDecimal::add);
        }

        // This month's spend per category
        for (Object[] row : transactionRepository.categoryBreakdown(userId, from, to)) {
            String     catName    = (String)    row[0];
            BigDecimal thisAmount = (BigDecimal) row[2];

            BigDecimal sum = priorSum.getOrDefault(catName, BigDecimal.ZERO);
            BigDecimal avg = sum.divide(BigDecimal.valueOf(ROLLING_MONTHS), 2, RoundingMode.HALF_UP);

            if (avg.compareTo(SPIKE_MIN_AVG) < 0) continue; // too small to be meaningful

            BigDecimal ratio = thisAmount.divide(avg, 2, RoundingMode.HALF_UP);
            if (ratio.compareTo(SPIKE_RATIO) <= 0) continue;

            // Express as "2.3× the 3-month average"
            String multiple = ratio.setScale(1, RoundingMode.HALF_UP).toPlainString() + "×";
            alerts.add(new AlertDto.Alert(
                    AlertDto.AlertType.CATEGORY_SPIKE,
                    catName,
                    multiple + " the 3-month average (avg ₹" + formatAmount(avg) + ")",
                    thisAmount
            ));
        }

        // Sort by amount descending
        alerts.sort(Comparator.comparing(AlertDto.Alert::amount).reversed());

        return new AlertDto.AlertSummary(anchor.format(MONTH_HEADER), alerts);
    }

    private LocalDate resolveAnchorMonth(UUID userId) {
        LocalDate latest = transactionRepository.latestTransactionDate(userId);
        return latest != null ? latest : LocalDate.now();
    }

    private static String formatAmount(BigDecimal amount) {
        return String.format("%,.0f", amount);
    }

    private static String truncate(String s, int max) {
        if (s == null) return "Unknown";
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }
}
