package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.Transaction;
import com.omprakashgautam.homelab.spends.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TransactionRepository extends JpaRepository<Transaction, UUID>,
        JpaSpecificationExecutor<Transaction> {

    boolean existsByImportHash(String importHash);
    Optional<Transaction> findByImportHash(String importHash);

    List<Transaction> findAllByIdInAndBankAccountUser(List<UUID> ids, User user);

    /**
     * Bulk-deletes all transactions for the user across all their bank accounts.
     * DB cascade (migration 007) automatically removes associated view_transaction rows.
     */
    @Modifying
    @Transactional
    @Query("DELETE FROM Transaction t WHERE t.bankAccount.user.id = :userId")
    void deleteAllByUserId(@Param("userId") UUID userId);

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

    // ── Budget: category-specific withdrawal sum (used for rollover calculation) ─

    @Query("""
        SELECT COALESCE(SUM(t.withdrawalAmount), 0)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.category.name = :categoryName
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.withdrawalAmount > 0
        """)
    BigDecimal sumWithdrawalsForCategory(@Param("userId") UUID userId,
                                         @Param("categoryName") String categoryName,
                                         @Param("from") LocalDate from,
                                         @Param("to") LocalDate to);

    // ── Dashboard: category breakdown ─────────────────────────────────────────

    @Query("""
        SELECT t.category.id, t.category.name, t.category.color, COALESCE(SUM(t.withdrawalAmount), 0)
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

    // ── Reports: distinct years with transaction data ──────────────────────────

    @Query("""
        SELECT DISTINCT YEAR(t.valueDate)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
        ORDER BY YEAR(t.valueDate) DESC
        """)
    List<Integer> availableYears(@Param("userId") UUID userId);

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
     *              sumWithdrawal, sumDeposit, count]
     */
    @Query("""
            SELECT t.merchantName,
                   t.category.name,
                   t.category.color,
                   FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM'),
                   COALESCE(SUM(t.withdrawalAmount), 0),
                   COALESCE(SUM(t.depositAmount), 0),
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

    // ── Net worth: monthly flow ───────────────────────────────────────────────

    @Query("""
        SELECT YEAR(t.valueDate) as yr, MONTH(t.valueDate) as mo,
               SUM(t.depositAmount) as totalIn, SUM(t.withdrawalAmount) as totalOut
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from
        GROUP BY YEAR(t.valueDate), MONTH(t.valueDate)
        ORDER BY yr, mo
        """)
    List<Object[]> monthlyFlow(@Param("userId") UUID userId, @Param("from") LocalDate from);

    // ── Data health: aggregate counts ─────────────────────────────────────────

    @Query("SELECT COUNT(t) FROM Transaction t WHERE t.bankAccount.user.id = :userId")
    long countByUserId(@Param("userId") UUID userId);

    @Query("SELECT COUNT(t) FROM Transaction t WHERE t.bankAccount.user.id = :userId AND t.category IS NULL")
    long countUncategorized(@Param("userId") UUID userId);

    /**
     * Counts transactions assigned to a named category. The implicit inner join on
     * t.category means null-category rows are already excluded, but the explicit
     * IS NOT NULL guard makes the intent clear and protects against accidental outer joins.
     */
    @Query("""
        SELECT COUNT(t) FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.category IS NOT NULL
          AND t.category.name = :categoryName
        """)
    long countByCategoryName(@Param("userId") UUID userId,
                             @Param("categoryName") String categoryName);

    @Query("SELECT MIN(t.valueDate) FROM Transaction t WHERE t.bankAccount.user.id = :userId")
    LocalDate earliestDate(@Param("userId") UUID userId);

    @Query("""
        SELECT COUNT(DISTINCT t.bankAccount.id) FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
        """)
    long countDistinctBankAccounts(@Param("userId") UUID userId);

    // ── Annual budgets: year-level withdrawal sum per category ────────────────

    @Query("""
        SELECT COALESCE(SUM(t.withdrawalAmount), 0)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.category.id = :categoryId
          AND YEAR(t.valueDate) = :year
          AND t.withdrawalAmount > 0
        """)
    BigDecimal sumWithdrawalsForCategoryAndYear(@Param("userId") UUID userId,
                                                @Param("categoryId") UUID categoryId,
                                                @Param("year") int year);

    // ── Notifications: large withdrawal detection ─────────────────────────────

    @Query("""
        SELECT t FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.withdrawalAmount >= :threshold
          AND t.valueDate >= :since
        ORDER BY t.withdrawalAmount DESC
        """)
    List<Transaction> findLargeWithdrawalsInLast24Hours(
        @Param("userId") UUID userId,
        @Param("since") LocalDate since,
        @Param("threshold") BigDecimal threshold);

    // ── Data health: near-duplicate candidates ────────────────────────────────

    /**
     * Groups withdrawals by (bank account, date, amount). If a group has more than one row,
     * the transactions may be accidental duplicates (same amount + date but different remarks).
     * Returns at most 10 groups, ordered by count desc then amount desc.
     * Deposit-only duplicates are intentionally excluded — withdrawal duplicates are the primary risk.
     *
     * Row layout: [accountNumberMasked (String), bankName (String), valueDate (LocalDate),
     *              withdrawalAmount (BigDecimal), count (Long)]
     */
    @Query("""
        SELECT t.bankAccount.accountNumberMasked, t.bankAccount.bankName,
               t.valueDate, t.withdrawalAmount, COUNT(t)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.withdrawalAmount > 0
        GROUP BY t.bankAccount.id, t.bankAccount.accountNumberMasked, t.bankAccount.bankName,
                 t.valueDate, t.withdrawalAmount
        HAVING COUNT(t) > 1
        ORDER BY COUNT(t) DESC, t.withdrawalAmount DESC
        LIMIT 10
        """)
    List<Object[]> findNearDuplicates(@Param("userId") UUID userId);
}
