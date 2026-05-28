package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.ForecastDto;
import com.omprakashgautam.homelab.spends.dto.RecurringDto;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ForecastService {

    private final TransactionRepository txRepo;
    private final RecurringService recurringService;

    private static final DateTimeFormatter MONTH_LABEL  = DateTimeFormatter.ofPattern("MMMM yyyy");
    private static final DateTimeFormatter AS_OF_LABEL  = DateTimeFormatter.ofPattern("d MMM");
    private static final DateTimeFormatter YEAR_MONTH   = DateTimeFormatter.ofPattern("yyyy-MM");

    @Transactional(readOnly = true)
    public ForecastDto.MonthlyForecast getForecast(UUID userId) {
        // ── Anchor month (month of latest imported transaction) ─────────────
        LocalDate latest = txRepo.latestTransactionDate(userId);
        if (latest == null) {
            // No transactions at all — return zeroed forecast
            LocalDate today = LocalDate.now();
            return new ForecastDto.MonthlyForecast(
                    today.format(MONTH_LABEL), today.format(AS_OF_LABEL),
                    BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                    today.getDayOfMonth(), today.lengthOfMonth(),
                    List.of(), true);
        }

        YearMonth anchorYM   = YearMonth.from(latest);
        LocalDate monthStart = anchorYM.atDay(1);
        LocalDate monthEnd   = anchorYM.atEndOfMonth();
        String anchorYMStr   = anchorYM.format(YEAR_MONTH);

        // ── Actual spend in anchor month ─────────────────────────────────────
        BigDecimal spentSoFar = txRepo.sumWithdrawals(userId, monthStart, monthEnd);
        if (spentSoFar == null) spentSoFar = BigDecimal.ZERO;

        // ── Recurring patterns ───────────────────────────────────────────────
        RecurringDto.RecurringSummary recurring = recurringService.getPatterns(userId, 12);

        // Pending = expected in anchor month but not yet active (i.e. not yet imported)
        List<ForecastDto.PendingCharge> pending = recurring.patterns().stream()
                .filter(p -> !p.activeThisMonth() && p.nextExpected().equals(anchorYMStr))
                .sorted(Comparator.comparing(RecurringDto.RecurringPattern::averageAmount).reversed())
                .map(p -> new ForecastDto.PendingCharge(
                        p.merchantName(),
                        p.categoryName(),
                        p.categoryColor(),
                        p.averageAmount()))
                .toList();

        BigDecimal projectedAdditional = pending.stream()
                .map(ForecastDto.PendingCharge::expectedAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal projectedTotal = spentSoFar.add(projectedAdditional);

        // ── Staleness check — warn if latest import is >7 days behind today ─
        boolean dataUpToDate = !latest.isBefore(LocalDate.now().minusDays(7));

        return new ForecastDto.MonthlyForecast(
                anchorYM.format(MONTH_LABEL),
                latest.format(AS_OF_LABEL),
                spentSoFar,
                projectedAdditional,
                projectedTotal,
                latest.getDayOfMonth(),
                anchorYM.lengthOfMonth(),
                pending,
                dataUpToDate
        );
    }
}
