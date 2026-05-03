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
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TransactionRepository extends JpaRepository<Transaction, UUID>,
        JpaSpecificationExecutor<Transaction> {

    boolean existsByImportHash(String importHash);
    Optional<Transaction> findByImportHash(String importHash);

    List<Transaction> findAllByBankAccountUserId(UUID userId);

    @Query("""
        SELECT DISTINCT t.merchantName
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.merchantName IS NOT NULL
          AND t.merchantName <> ''
        ORDER BY t.merchantName
        """)
    List<String> findDistinctMerchantNames(@Param("userId") UUID userId);

    List<Transaction> findAllByIdInAndBankAccountUser(List<UUID> ids, User user);

    @Query("""
        SELECT DISTINCT t.rawRemarks
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.rawRemarks IS NOT NULL
          AND t.rawRemarks <> ''
        """)
    List<String> findDistinctRawRemarks(@Param("userId") UUID userId);

    @Query("""
        SELECT t FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND LOWER(t.rawRemarks) LIKE LOWER(CONCAT('%', :tag, '%'))
        ORDER BY t.valueDate DESC
        """)
    List<Transaction> findByUserIdAndRawRemarksContaining(
            @Param("userId") UUID userId, @Param("tag") String tag);

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

    // ── Dashboard: account-filtered variants ──────────────────────────────────

    @Query("""
        SELECT COALESCE(SUM(t.withdrawalAmount), 0)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.bankAccount.id = :accountId
        """)
    BigDecimal sumWithdrawalsFiltered(@Param("userId") UUID userId,
                                      @Param("from") LocalDate from,
                                      @Param("to") LocalDate to,
                                      @Param("accountId") UUID accountId);

    @Query("""
        SELECT COALESCE(SUM(t.depositAmount), 0)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.bankAccount.id = :accountId
        """)
    BigDecimal sumDepositsFiltered(@Param("userId") UUID userId,
                                   @Param("from") LocalDate from,
                                   @Param("to") LocalDate to,
                                   @Param("accountId") UUID accountId);

    @Query("""
        SELECT COUNT(t)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.bankAccount.id = :accountId
        """)
    long countInPeriodFiltered(@Param("userId") UUID userId,
                               @Param("from") LocalDate from,
                               @Param("to") LocalDate to,
                               @Param("accountId") UUID accountId);

    @Query("""
        SELECT t.category.id, t.category.name, t.category.color, COALESCE(SUM(t.withdrawalAmount), 0)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.withdrawalAmount > 0
          AND t.category IS NOT NULL
          AND t.bankAccount.id = :accountId
        GROUP BY t.category.id, t.category.name, t.category.color
        ORDER BY SUM(t.withdrawalAmount) DESC
        """)
    List<Object[]> categoryBreakdownFiltered(@Param("userId") UUID userId,
                                              @Param("from") LocalDate from,
                                              @Param("to") LocalDate to,
                                              @Param("accountId") UUID accountId);

    @Query("""
        SELECT FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM'),
               COALESCE(SUM(t.withdrawalAmount), 0),
               COALESCE(SUM(t.depositAmount), 0)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from
          AND t.bankAccount.id = :accountId
        GROUP BY FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM')
        ORDER BY FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM') ASC
        """)
    List<Object[]> monthlyTrendFiltered(@Param("userId") UUID userId,
                                         @Param("from") LocalDate from,
                                         @Param("accountId") UUID accountId);

    @Query("""
        SELECT t.merchantName, COALESCE(SUM(t.withdrawalAmount), 0), COUNT(t)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.withdrawalAmount > 0
          AND t.merchantName IS NOT NULL
          AND t.bankAccount.id = :accountId
        GROUP BY t.merchantName
        ORDER BY SUM(t.withdrawalAmount) DESC
        LIMIT 8
        """)
    List<Object[]> topMerchantsFiltered(@Param("userId") UUID userId,
                                         @Param("from") LocalDate from,
                                         @Param("to") LocalDate to,
                                         @Param("accountId") UUID accountId);

    @Query("""
        SELECT MAX(t.valueDate)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.bankAccount.id = :accountId
        """)
    LocalDate latestTransactionDateFiltered(@Param("userId") UUID userId,
                                             @Param("accountId") UUID accountId);

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

    // ── Widget: category breakdown for a set of category IDs ─────────────────

    @Query("""
        SELECT t.category.id, t.category.name, t.category.color, COALESCE(SUM(t.withdrawalAmount), 0)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.withdrawalAmount > 0
          AND t.category.id IN :categoryIds
        GROUP BY t.category.id, t.category.name, t.category.color
        ORDER BY SUM(t.withdrawalAmount) DESC
        """)
    List<Object[]> categoryBreakdownForIds(@Param("userId") UUID userId,
                                            @Param("from") LocalDate from,
                                            @Param("to") LocalDate to,
                                            @Param("categoryIds") Collection<UUID> categoryIds);

    @Query("""
        SELECT t.category.id, t.category.name, t.category.color, COALESCE(SUM(t.depositAmount), 0)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.depositAmount > 0
          AND t.category.id IN :categoryIds
        GROUP BY t.category.id, t.category.name, t.category.color
        ORDER BY SUM(t.depositAmount) DESC
        """)
    List<Object[]> categoryBreakdownForIdsIncome(@Param("userId") UUID userId,
                                                  @Param("from") LocalDate from,
                                                  @Param("to") LocalDate to,
                                                  @Param("categoryIds") Collection<UUID> categoryIds);

    @Query("""
        SELECT t.category.id, t.category.name, t.category.color, COUNT(t)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.category.id IN :categoryIds
        GROUP BY t.category.id, t.category.name, t.category.color
        ORDER BY COUNT(t) DESC
        """)
    List<Object[]> categoryBreakdownForIdsCount(@Param("userId") UUID userId,
                                                 @Param("from") LocalDate from,
                                                 @Param("to") LocalDate to,
                                                 @Param("categoryIds") Collection<UUID> categoryIds);

    // ── Widget: monthly spend/income/count for a set of category IDs ──────────

    @Query("""
        SELECT FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM'),
               COALESCE(SUM(t.withdrawalAmount), 0),
               COALESCE(SUM(t.depositAmount), 0),
               COUNT(t)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.category.id IN :categoryIds
        GROUP BY FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM')
        ORDER BY FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM') ASC
        """)
    List<Object[]> monthlyTrendForIds(@Param("userId") UUID userId,
                                       @Param("from") LocalDate from,
                                       @Param("to") LocalDate to,
                                       @Param("categoryIds") Collection<UUID> categoryIds);

    // ── Widget: category breakdown for ALL transactions ───────────────────────

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
    List<Object[]> categoryBreakdownAll(@Param("userId") UUID userId,
                                         @Param("from") LocalDate from,
                                         @Param("to") LocalDate to);

    @Query("""
        SELECT t.category.id, t.category.name, t.category.color, COALESCE(SUM(t.depositAmount), 0)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.depositAmount > 0
          AND t.category IS NOT NULL
        GROUP BY t.category.id, t.category.name, t.category.color
        ORDER BY SUM(t.depositAmount) DESC
        """)
    List<Object[]> categoryBreakdownAllIncome(@Param("userId") UUID userId,
                                               @Param("from") LocalDate from,
                                               @Param("to") LocalDate to);

    @Query("""
        SELECT t.category.id, t.category.name, t.category.color, COUNT(t)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.category IS NOT NULL
        GROUP BY t.category.id, t.category.name, t.category.color
        ORDER BY COUNT(t) DESC
        """)
    List<Object[]> categoryBreakdownAllCount(@Param("userId") UUID userId,
                                              @Param("from") LocalDate from,
                                              @Param("to") LocalDate to);

    // ── Widget: monthly trend for ALL transactions ────────────────────────────

    @Query("""
        SELECT FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM'),
               COALESCE(SUM(t.withdrawalAmount), 0),
               COALESCE(SUM(t.depositAmount), 0),
               COUNT(t)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
        GROUP BY FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM')
        ORDER BY FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM') ASC
        """)
    List<Object[]> monthlyTrendAll(@Param("userId") UUID userId,
                                    @Param("from") LocalDate from,
                                    @Param("to") LocalDate to);

    // ── Widget: account-aware (null-safe) variants ──────────────────────────

    @Query("""
        SELECT t.category.id, t.category.name, t.category.color, COALESCE(SUM(t.withdrawalAmount), 0)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.withdrawalAmount > 0
          AND t.category IS NOT NULL
          AND (CAST(:accountId AS uuid) IS NULL OR t.bankAccount.id = CAST(:accountId AS uuid))
        GROUP BY t.category.id, t.category.name, t.category.color
        ORDER BY SUM(t.withdrawalAmount) DESC
        """)
    List<Object[]> categoryBreakdownAllByAccount(@Param("userId") UUID userId,
                                                  @Param("from") LocalDate from,
                                                  @Param("to") LocalDate to,
                                                  @Param("accountId") UUID accountId);

    @Query("""
        SELECT t.category.id, t.category.name, t.category.color, COALESCE(SUM(t.depositAmount), 0)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.depositAmount > 0
          AND t.category IS NOT NULL
          AND (CAST(:accountId AS uuid) IS NULL OR t.bankAccount.id = CAST(:accountId AS uuid))
        GROUP BY t.category.id, t.category.name, t.category.color
        ORDER BY SUM(t.depositAmount) DESC
        """)
    List<Object[]> categoryBreakdownAllIncomeByAccount(@Param("userId") UUID userId,
                                                        @Param("from") LocalDate from,
                                                        @Param("to") LocalDate to,
                                                        @Param("accountId") UUID accountId);

    @Query("""
        SELECT t.category.id, t.category.name, t.category.color, COUNT(t)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.category IS NOT NULL
          AND (CAST(:accountId AS uuid) IS NULL OR t.bankAccount.id = CAST(:accountId AS uuid))
        GROUP BY t.category.id, t.category.name, t.category.color
        ORDER BY COUNT(t) DESC
        """)
    List<Object[]> categoryBreakdownAllCountByAccount(@Param("userId") UUID userId,
                                                       @Param("from") LocalDate from,
                                                       @Param("to") LocalDate to,
                                                       @Param("accountId") UUID accountId);

    @Query("""
        SELECT t.category.id, t.category.name, t.category.color, COALESCE(SUM(t.withdrawalAmount), 0)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.withdrawalAmount > 0
          AND t.category.id IN :categoryIds
          AND (CAST(:accountId AS uuid) IS NULL OR t.bankAccount.id = CAST(:accountId AS uuid))
        GROUP BY t.category.id, t.category.name, t.category.color
        ORDER BY SUM(t.withdrawalAmount) DESC
        """)
    List<Object[]> categoryBreakdownForIdsByAccount(@Param("userId") UUID userId,
                                                     @Param("from") LocalDate from,
                                                     @Param("to") LocalDate to,
                                                     @Param("categoryIds") Collection<UUID> categoryIds,
                                                     @Param("accountId") UUID accountId);

    @Query("""
        SELECT t.category.id, t.category.name, t.category.color, COALESCE(SUM(t.depositAmount), 0)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.depositAmount > 0
          AND t.category.id IN :categoryIds
          AND (CAST(:accountId AS uuid) IS NULL OR t.bankAccount.id = CAST(:accountId AS uuid))
        GROUP BY t.category.id, t.category.name, t.category.color
        ORDER BY SUM(t.depositAmount) DESC
        """)
    List<Object[]> categoryBreakdownForIdsIncomeByAccount(@Param("userId") UUID userId,
                                                           @Param("from") LocalDate from,
                                                           @Param("to") LocalDate to,
                                                           @Param("categoryIds") Collection<UUID> categoryIds,
                                                           @Param("accountId") UUID accountId);

    @Query("""
        SELECT t.category.id, t.category.name, t.category.color, COUNT(t)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.category.id IN :categoryIds
          AND (CAST(:accountId AS uuid) IS NULL OR t.bankAccount.id = CAST(:accountId AS uuid))
        GROUP BY t.category.id, t.category.name, t.category.color
        ORDER BY COUNT(t) DESC
        """)
    List<Object[]> categoryBreakdownForIdsCountByAccount(@Param("userId") UUID userId,
                                                          @Param("from") LocalDate from,
                                                          @Param("to") LocalDate to,
                                                          @Param("categoryIds") Collection<UUID> categoryIds,
                                                          @Param("accountId") UUID accountId);

    @Query("""
        SELECT FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM'),
               COALESCE(SUM(t.withdrawalAmount), 0),
               COALESCE(SUM(t.depositAmount), 0),
               COUNT(t)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND (CAST(:accountId AS uuid) IS NULL OR t.bankAccount.id = CAST(:accountId AS uuid))
        GROUP BY FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM')
        ORDER BY FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM') ASC
        """)
    List<Object[]> monthlyTrendAllByAccount(@Param("userId") UUID userId,
                                             @Param("from") LocalDate from,
                                             @Param("to") LocalDate to,
                                             @Param("accountId") UUID accountId);

    @Query("""
        SELECT FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM'),
               COALESCE(SUM(t.withdrawalAmount), 0),
               COALESCE(SUM(t.depositAmount), 0),
               COUNT(t)
        FROM Transaction t
        WHERE t.bankAccount.user.id = :userId
          AND t.valueDate >= :from AND t.valueDate <= :to
          AND t.category.id IN :categoryIds
          AND (CAST(:accountId AS uuid) IS NULL OR t.bankAccount.id = CAST(:accountId AS uuid))
        GROUP BY FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM')
        ORDER BY FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM') ASC
        """)
    List<Object[]> monthlyTrendForIdsByAccount(@Param("userId") UUID userId,
                                                @Param("from") LocalDate from,
                                                @Param("to") LocalDate to,
                                                @Param("categoryIds") Collection<UUID> categoryIds,
                                                @Param("accountId") UUID accountId);
}
