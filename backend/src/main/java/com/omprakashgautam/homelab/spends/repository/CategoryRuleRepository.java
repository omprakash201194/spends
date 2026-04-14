package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.CategoryRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CategoryRuleRepository extends JpaRepository<CategoryRule, UUID> {
    List<CategoryRule> findByUserIdOrderByPriorityDesc(UUID userId);
}
