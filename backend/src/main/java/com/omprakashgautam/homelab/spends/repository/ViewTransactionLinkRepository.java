package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.Transaction;
import com.omprakashgautam.homelab.spends.model.ViewTransactionLink;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ViewTransactionLinkRepository extends JpaRepository<ViewTransactionLink, UUID> {

    boolean existsByViewIdAndTransactionId(UUID viewId, UUID transactionId);

    Optional<ViewTransactionLink> findByViewIdAndTransactionId(UUID viewId, UUID transactionId);

    long countByViewId(UUID viewId);

    // ── List tab: paginated transactions in a view ─────────────────────────────

    @Query(value = """
        SELECT vtl.transaction
        FROM ViewTransactionLink vtl
        JOIN FETCH vtl.transaction.bankAccount ba
        JOIN FETCH ba.user
        WHERE vtl.view.id = :viewId
        ORDER BY vtl.transaction.valueDate DESC
        """,
        countQuery = """
        SELECT COUNT(vtl)
        FROM ViewTransactionLink vtl
        WHERE vtl.view.id = :viewId
        """)
    Page<Transaction> findTransactionsByViewId(
            @Param("viewId") UUID viewId,
            Pageable pageable);

    @Query(value = """
        SELECT vtl.transaction
        FROM ViewTransactionLink vtl
        JOIN FETCH vtl.transaction.bankAccount ba
        JOIN FETCH ba.user
        WHERE vtl.view.id = :viewId
          AND vtl.transaction.bankAccount.id = :accountId
        ORDER BY vtl.transaction.valueDate DESC
        """,
        countQuery = """
        SELECT COUNT(vtl)
        FROM ViewTransactionLink vtl
        WHERE vtl.view.id = :viewId
          AND vtl.transaction.bankAccount.id = :accountId
        """)
    Page<Transaction> findTransactionsByViewIdFiltered(
            @Param("viewId") UUID viewId,
            @Param("accountId") UUID accountId,
            Pageable pageable);

    // ── Auto-tag on create ────────────────────────────────────────────────────

    @Query("""
        SELECT t FROM Transaction t
        WHERE t.bankAccount.user.household.id = :householdId
          AND t.valueDate >= :startDate
          AND t.valueDate <= :endDate
        """)
    List<Transaction> findHouseholdTransactionsInRange(
            @Param("householdId") UUID householdId,
            @Param("startDate")   LocalDate startDate,
            @Param("endDate")     LocalDate endDate
    );

    // ── Summary: total debit spend ─────────────────────────────────────────────

    @Query("""
        SELECT COALESCE(SUM(vtl.transaction.withdrawalAmount), 0)
        FROM ViewTransactionLink vtl
        WHERE vtl.view.id = :viewId
          AND vtl.transaction.withdrawalAmount > 0
        """)
    BigDecimal totalSpentByViewId(@Param("viewId") UUID viewId);

    // ── Summary: category breakdown ────────────────────────────────────────────

    @Query("""
        SELECT vtl.transaction.category.id,
               vtl.transaction.category.name,
               vtl.transaction.category.color,
               COALESCE(SUM(vtl.transaction.withdrawalAmount), 0)
        FROM ViewTransactionLink vtl
        WHERE vtl.view.id = :viewId
          AND vtl.transaction.withdrawalAmount > 0
          AND vtl.transaction.category IS NOT NULL
        GROUP BY vtl.transaction.category.id,
                 vtl.transaction.category.name,
                 vtl.transaction.category.color
        ORDER BY SUM(vtl.transaction.withdrawalAmount) DESC
        """)
    List<Object[]> categoryBreakdownByViewId(@Param("viewId") UUID viewId);

    // ── Summary: per-member breakdown ──────────────────────────────────────────

    @Query("""
        SELECT vtl.transaction.bankAccount.user.id,
               vtl.transaction.bankAccount.user.displayName,
               COALESCE(SUM(vtl.transaction.withdrawalAmount), 0),
               COUNT(vtl)
        FROM ViewTransactionLink vtl
        WHERE vtl.view.id = :viewId
          AND vtl.transaction.withdrawalAmount > 0
        GROUP BY vtl.transaction.bankAccount.user.id,
                 vtl.transaction.bankAccount.user.displayName
        ORDER BY SUM(vtl.transaction.withdrawalAmount) DESC
        """)
    List<Object[]> memberBreakdownByViewId(@Param("viewId") UUID viewId);
}
