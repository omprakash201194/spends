package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.CategoryRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface CategoryRuleRepository extends JpaRepository<CategoryRule, UUID> {
    List<CategoryRule> findByUserIdOrderByPriorityDesc(UUID userId);

    List<CategoryRule> findByGlobalTrueOrderByPriorityDesc();

    /**
     * Returns user-specific rules first (ordered by priority DESC), then global rules.
     * Used during import to build the full matching rule set for a user.
     */
    @Query("""
        SELECT r FROM CategoryRule r
        LEFT JOIN FETCH r.category
        WHERE r.user.id = :userId OR r.global = TRUE
        ORDER BY r.priority DESC
        """)
    List<CategoryRule> findAllApplicableRules(@Param("userId") UUID userId);

    @Query("""
        SELECT r FROM CategoryRule r
        JOIN FETCH r.category
        WHERE r.user.id = :userId
        ORDER BY r.priority DESC, r.createdAt DESC
        """)
    List<CategoryRule> listRulesForUser(@Param("userId") UUID userId);

    @Query("SELECT COUNT(r) FROM CategoryRule r WHERE r.user.id = :userId")
    long countByUserId(@Param("userId") UUID userId);

    @Query("SELECT COUNT(r) FROM CategoryRule r WHERE r.global = TRUE")
    long countGlobal();
}
