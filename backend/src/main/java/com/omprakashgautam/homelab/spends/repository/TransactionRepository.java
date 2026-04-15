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
}
