package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CategoryRepository extends JpaRepository<Category, UUID> {
    Optional<Category> findByName(String name);
    List<Category> findBySystemTrue();
    List<Category> findByHouseholdId(UUID householdId);
    List<Category> findBySystemTrueOrHouseholdId(UUID householdId);
    boolean existsByNameAndHouseholdId(String name, UUID householdId);
}
