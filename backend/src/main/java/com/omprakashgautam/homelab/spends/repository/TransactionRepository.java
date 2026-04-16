package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TransactionRepository extends JpaRepository<Transaction, UUID>,
        JpaSpecificationExecutor<Transaction> {

    boolean existsByImportHash(String importHash);
    Optional<Transaction> findByImportHash(String importHash);

    // ── Dashboard: monthly summary ────────────────────────────────────────────

    @Query("""
        SELECT COALESCE(SUM(t.withdrawalAmount), 0)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
        """)
    BigDecimal sumWithdrawals(@Param("userId") UUID userId,
                              @Param("from") LocalDate from,
                              @Param("to") LocalDate to);

    @Query("""
        SELECT COALESCE(SUM(t.depositAmount), 0)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
        """)
    BigDecimal sumDeposits(@Param("userId") UUID userId,
                           @Param("from") LocalDate from,
                           @Param("to") LocalDate to);

    @Query("""
        SELECT COUNT(t)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
        """)
    long countInPeriod(@Param("userId") UUID userId,
                       @Param("from") LocalDate from,
                       @Param("to") LocalDate to);

    // ── Dashboard: category breakdown ─────────────────────────────────────────

    @Query("""
        SELECT t.category.name, t.category.color, COALESCE(SUM(t.withdrawalAmount), 0)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.withdrawalAmount > 0
          AND t.category IS NOT NULL
        GROUP BY t.category.id, t.category.name, t.category.color
        ORDER BY SUM(t.withdrawalAmount) DESC
        """)
    List<Object[]> categoryBreakdown(@Param("userId") UUID userId,
                                     @Param("from") LocalDate from,
                                     @Param("to") LocalDate to);

    // ── Dashboard: 12-month trend ─────────────────────────────────────────────

    @Query("""
        SELECT FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM'),
               COALESCE(SUM(t.withdrawalAmount), 0),
               COALESCE(SUM(t.depositAmount), 0)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from
        GROUP BY FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM')
        ORDER BY FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM') ASC
        """)
    List<Object[]> monthlyTrend(@Param("userId") UUID userId,
                                @Param("from") LocalDate from);

    // ── Dashboard: most recent transaction date ───────────────────────────────

    @Query("""
        SELECT MAX(t.valueDate)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
        """)
    LocalDate latestTransactionDate(@Param("userId") UUID userId);

    // ── Alerts: large single withdrawals ─────────────────────────────────────

    @Query("""
        SELECT t.merchantName, t.withdrawalAmount, t.valueDate, t.rawRemarks
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.withdrawalAmount > :threshold
        ORDER BY t.withdrawalAmount DESC
        LIMIT 5
        """)
    List<Object[]> findLargeTransactions(@Param("userId") UUID userId,
                                          @Param("from") LocalDate from,
                                          @Param("to") LocalDate to,
                                          @Param("threshold") java.math.BigDecimal threshold);

    // ── Alerts: new merchants (no history in prior window) ────────────────────

    @Query("""
        SELECT t.merchantName, COALESCE(SUM(t.withdrawalAmount), 0)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.withdrawalAmount > 0
          AND t.merchantName IS NOT NULL
          AND t.merchantName NOT IN (
              SELECT DISTINCT t2.merchantName
              FROM Transaction t2
              WHERE t2.bankAccount.user.id = :userId
                AND t2.valueDate >= :historyFrom AND t2.valueDate < :from
                AND t2.merchantName IS NOT NULL
          )
        GROUP BY t.merchantName
        ORDER BY SUM(t.withdrawalAmount) DESC
        LIMIT 5
        """)
    List<Object[]> findNewMerchantsWithSpend(@Param("userId") UUID userId,
                                              @Param("from") LocalDate from,
                                              @Param("to") LocalDate to,
                                              @Param("historyFrom") LocalDate historyFrom);

    // ── Alerts: category spend broken down by month (rolling average) ─────────

    @Query("""
        SELECT FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM'),
               t.category.name,
               t.category.color,
               COALESCE(SUM(t.withdrawalAmount), 0)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.withdrawalAmount > 0
          AND t.category IS NOT NULL
        GROUP BY FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM'),
                 t.category.id, t.category.name, t.category.color
        """)
    List<Object[]> categorySpendByMonth(@Param("userId") UUID userId,
                                         @Param("from") LocalDate from,
                                         @Param("to") LocalDate to);

    // ── Household: most recent transaction date across all members ────────────

    @Query("""
        SELECT MAX(t.valueDate)
        FROM Transaction t
        WHERE t.bankAccount.user.household.id = :householdId
        """)
    LocalDate latestTransactionDateForHousehold(@Param("householdId") UUID householdId);

    // ── Dashboard: top merchants ──────────────────────────────────────────────

    @Query("""
        SELECT t.merchantName, COALESCE(SUM(t.withdrawalAmount), 0), COUNT(t)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.withdrawalAmount > 0
          AND t.merchantName IS NOT NULL
        GROUP BY t.merchantName
        ORDER BY SUM(t.withdrawalAmount) DESC
        LIMIT 8
        """)
    List<Object[]> topMerchants(@Param("userId") UUID userId,
                                @Param("from") LocalDate from,
                                @Param("to") LocalDate to);

    // ── Recurring: merchant monthly activity pattern detection ────────────────

    /**
     * Groups all non-null-merchant transactions by merchant + calendar month.
     * Returns one row per (merchant, month) with the average withdrawal,
     * average deposit, and transaction count. Used by RecurringService to
     * detect recurring patterns.
     *
     * Row layout: [merchantName, categoryName, categoryColor, yearMonth (yyyy-MM),
     *              avgWithdrawal, avgDeposit, count]
     */
    @Query("""
            SELECT t.merchantName,
                   t.category.name,
                   t.category.color,
                   FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM'),
                   COALESCE(AVG(t.withdrawalAmount), 0),
                   COALESCE(AVG(t.depositAmount), 0),
                   COUNT(t)
            FROM Transaction t
            WHERE t.bankAccount.user.id = :userId
              AND t.valueDate >= :from
              AND t.merchantName IS NOT NULL
              AND (t.withdrawalAmount > 0 OR t.depositAmount > 0)
            GROUP BY t.merchantName,
                     t.category.id,
                     t.category.name,
                     t.category.color,
                     FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM')
            ORDER BY t.merchantName,
                     FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM')
            """)
    List<Object[]> merchantMonthlyActivity(@Param("userId") UUID userId,
                                            @Param("from") LocalDate from);
}
