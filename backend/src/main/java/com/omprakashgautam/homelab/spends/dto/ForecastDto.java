package com.omprakashgautam.homelab.spends.dto;

import java.math.BigDecimal;
import java.util.List;

public class ForecastDto {

    /**
     * A single recurring charge that is expected in the anchor month but has not
     * yet appeared in the imported transactions.
     */
    public record PendingCharge(
            String merchantName,
            String categoryName,
            String categoryColor,
            BigDecimal expectedAmount
    ) {}

    /**
     * Full monthly forecast response.
     *
     * <ul>
     *   <li>{@code month} — display label, e.g. "June 2025"</li>
     *   <li>{@code asOf} — date of the latest imported transaction, e.g. "18 Jun"</li>
     *   <li>{@code spentSoFar} — total withdrawals imported so far in the anchor month</li>
     *   <li>{@code projectedAdditional} — sum of expectedAmount for all pending recurring charges</li>
     *   <li>{@code projectedTotal} — spentSoFar + projectedAdditional</li>
     *   <li>{@code daysElapsed} — day-of-month of the latest transaction</li>
     *   <li>{@code daysInMonth} — total days in the anchor month</li>
     *   <li>{@code pendingCharges} — recurring charges expected but not yet seen (ordered by expectedAmount desc)</li>
     *   <li>{@code dataUpToDate} — false when the latest import is more than 7 days behind today (stale data warning)</li>
     * </ul>
     */
    public record MonthlyForecast(
            String month,
            String asOf,
            BigDecimal spentSoFar,
            BigDecimal projectedAdditional,
            BigDecimal projectedTotal,
            int daysElapsed,
            int daysInMonth,
            List<PendingCharge> pendingCharges,
            boolean dataUpToDate
    ) {}
}
