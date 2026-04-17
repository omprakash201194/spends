package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CategoryRepository extends JpaRepository<Category, UUID> {
    Optional<Category> findByName(String name);
    List<Category> findBySystemTrue();
    List<Category> findByHouseholdId(UUID householdId);
    @Query("SELECT c FROM Category c LEFT JOIN FETCH c.parent WHERE c.system = true OR c.household.id = :householdId")
    List<Category> findBySystemTrueOrHouseholdId(@Param("householdId") UUID householdId);
    boolean existsByNameAndHouseholdId(String name, UUID householdId);

    @Modifying
    @Transactional
    @Query("DELETE FROM Category c WHERE c.household.id = :householdId AND c.system = false")
    void deleteAllByHouseholdIdAndSystemFalse(@Param("householdId") UUID householdId);
}
