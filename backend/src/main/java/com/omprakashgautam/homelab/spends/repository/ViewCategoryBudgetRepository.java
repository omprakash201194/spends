package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.ViewCategoryBudget;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ViewCategoryBudgetRepository extends JpaRepository<ViewCategoryBudget, UUID> {
    List<ViewCategoryBudget> findByViewId(UUID viewId);
    void deleteByViewId(UUID viewId);
}
