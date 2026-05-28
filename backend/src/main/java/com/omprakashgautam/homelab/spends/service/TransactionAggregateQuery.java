package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.TransactionDto.MonthAgg;
import com.omprakashgautam.homelab.spends.dto.TransactionDto.WeekAgg;
import com.omprakashgautam.homelab.spends.dto.TransactionDto.YearAgg;
import com.omprakashgautam.homelab.spends.model.Transaction;
import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import lombok.RequiredArgsConstructor;
import org.hibernate.query.criteria.HibernateCriteriaBuilder;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

/**
 * CriteriaBuilder-based aggregation queries for the Transactions time-view pickers.
 * Each method takes the same {@link Specification} that powers the list endpoint,
 * so the picker counts honor every active filter (search, account, category, type,
 * uncategorizedOnly) without re-implementing the predicate logic in JPQL.
 *
 * Uses {@link HibernateCriteriaBuilder} for year/month/day extraction so that
 * Hibernate translates them to EXTRACT(YEAR/MONTH/DAY FROM ...) — required for
 * PostgreSQL which has no year() / month() / day() SQL functions.
 *
 * Bucket math for {@link #weekAggregates}: day 1–7 → bucket 0, 8–14 → 1, 15–21 → 2,
 * 22–28 → 3, 29 to end-of-month → 4.
 */
@Component
@RequiredArgsConstructor
public class TransactionAggregateQuery {

    private final EntityManager entityManager;

    public List<YearAgg> yearAggregates(Specification<Transaction> spec) {
        HibernateCriteriaBuilder cb = (HibernateCriteriaBuilder) entityManager.getCriteriaBuilder();
        CriteriaQuery<Object[]> q = cb.createQuery(Object[].class);
        Root<Transaction> root = q.from(Transaction.class);

        Predicate p = spec.toPredicate(root, q, cb);
        if (p != null) q.where(p);

        Expression<Integer> yearExpr = cb.year(root.get("valueDate"));
        Expression<Long> total = cb.count(root);
        Expression<Long> uncat = cb.sum(cb.<Long>selectCase()
                .when(cb.isNull(root.get("category")), 1L)
                .otherwise(0L)
                .as(Long.class));
        Expression<BigDecimal> debit  = cb.coalesce(cb.sum(root.<BigDecimal>get("withdrawalAmount")), BigDecimal.ZERO);
        Expression<BigDecimal> credit = cb.coalesce(cb.sum(root.<BigDecimal>get("depositAmount")),    BigDecimal.ZERO);

        q.multiselect(yearExpr, total, uncat, debit, credit);
        q.groupBy(yearExpr);
        q.orderBy(cb.desc(yearExpr));

        return entityManager.createQuery(q).getResultList().stream()
                .map(row -> new YearAgg(
                        ((Number) row[0]).intValue(),
                        ((Number) row[1]).longValue(),
                        row[2] == null ? 0L : ((Number) row[2]).longValue(),
                        row[3] == null ? BigDecimal.ZERO : (BigDecimal) row[3],
                        row[4] == null ? BigDecimal.ZERO : (BigDecimal) row[4]))
                .toList();
    }

    public List<MonthAgg> monthAggregates(Specification<Transaction> spec, int year) {
        HibernateCriteriaBuilder cb = (HibernateCriteriaBuilder) entityManager.getCriteriaBuilder();
        CriteriaQuery<Object[]> q = cb.createQuery(Object[].class);
        Root<Transaction> root = q.from(Transaction.class);

        List<Predicate> predicates = new ArrayList<>();
        Predicate specPred = spec.toPredicate(root, q, cb);
        if (specPred != null) predicates.add(specPred);

        Expression<Integer> yearExpr  = cb.year(root.get("valueDate"));
        Expression<Integer> monthExpr = cb.month(root.get("valueDate"));
        predicates.add(cb.equal(yearExpr, year));

        q.where(predicates.toArray(new Predicate[0]));

        Expression<Long> total = cb.count(root);
        Expression<Long> uncat = cb.sum(cb.<Long>selectCase()
                .when(cb.isNull(root.get("category")), 1L)
                .otherwise(0L)
                .as(Long.class));
        Expression<BigDecimal> debit  = cb.coalesce(cb.sum(root.<BigDecimal>get("withdrawalAmount")), BigDecimal.ZERO);
        Expression<BigDecimal> credit = cb.coalesce(cb.sum(root.<BigDecimal>get("depositAmount")),    BigDecimal.ZERO);

        q.multiselect(monthExpr, total, uncat, debit, credit);
        q.groupBy(monthExpr);
        q.orderBy(cb.asc(monthExpr));

        return entityManager.createQuery(q).getResultList().stream()
                .map(row -> new MonthAgg(
                        ((Number) row[0]).intValue(),
                        ((Number) row[1]).longValue(),
                        row[2] == null ? 0L : ((Number) row[2]).longValue(),
                        row[3] == null ? BigDecimal.ZERO : (BigDecimal) row[3],
                        row[4] == null ? BigDecimal.ZERO : (BigDecimal) row[4]))
                .toList();
    }

    public List<WeekAgg> weekAggregates(Specification<Transaction> spec, int year, int month) {
        HibernateCriteriaBuilder cb = (HibernateCriteriaBuilder) entityManager.getCriteriaBuilder();
        CriteriaQuery<Object[]> q = cb.createQuery(Object[].class);
        Root<Transaction> root = q.from(Transaction.class);

        List<Predicate> predicates = new ArrayList<>();
        Predicate specPred = spec.toPredicate(root, q, cb);
        if (specPred != null) predicates.add(specPred);

        Expression<Integer> yearExpr  = cb.year(root.get("valueDate"));
        Expression<Integer> monthExpr = cb.month(root.get("valueDate"));
        Expression<Integer> dayExpr   = cb.day(root.get("valueDate"));

        predicates.add(cb.equal(yearExpr, year));
        predicates.add(cb.equal(monthExpr, month));
        q.where(predicates.toArray(new Predicate[0]));

        Expression<Integer> bucket = cb.<Integer>selectCase()
                .when(cb.lessThanOrEqualTo(dayExpr, 7), 0)
                .when(cb.lessThanOrEqualTo(dayExpr, 14), 1)
                .when(cb.lessThanOrEqualTo(dayExpr, 21), 2)
                .when(cb.lessThanOrEqualTo(dayExpr, 28), 3)
                .otherwise(4)
                .as(Integer.class);

        Expression<Long> total = cb.count(root);
        Expression<Long> uncat = cb.sum(cb.<Long>selectCase()
                .when(cb.isNull(root.get("category")), 1L)
                .otherwise(0L)
                .as(Long.class));
        Expression<BigDecimal> debit  = cb.coalesce(cb.sum(root.<BigDecimal>get("withdrawalAmount")), BigDecimal.ZERO);
        Expression<BigDecimal> credit = cb.coalesce(cb.sum(root.<BigDecimal>get("depositAmount")),    BigDecimal.ZERO);

        q.multiselect(bucket, total, uncat, debit, credit);
        q.groupBy(bucket);
        q.orderBy(cb.asc(bucket));

        int lengthOfMonth = YearMonth.of(year, month).lengthOfMonth();
        return entityManager.createQuery(q).getResultList().stream()
                .map(row -> {
                    int b = ((Number) row[0]).intValue();
                    int startDay = b * 7 + 1;
                    int endDay = (b == 4) ? lengthOfMonth : Math.min(startDay + 6, lengthOfMonth);
                    return new WeekAgg(
                            b, startDay, endDay,
                            ((Number) row[1]).longValue(),
                            row[2] == null ? 0L : ((Number) row[2]).longValue(),
                            row[3] == null ? BigDecimal.ZERO : (BigDecimal) row[3],
                            row[4] == null ? BigDecimal.ZERO : (BigDecimal) row[4]);
                })
                .toList();
    }
}
