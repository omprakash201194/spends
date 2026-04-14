package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.Budget;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BudgetRepository extends JpaRepository<Budget, UUID> {
    List<Budget> findByUserIdAndYearAndMonth(UUID userId, int year, int month);
    Optional<Budget> findByUserIdAndCategoryIdAndYearAndMonth(UUID userId, UUID categoryId, int year, int month);
}
