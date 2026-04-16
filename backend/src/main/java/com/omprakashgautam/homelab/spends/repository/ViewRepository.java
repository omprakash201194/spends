package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.SpendView;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

public interface ViewRepository extends JpaRepository<SpendView, UUID> {
    List<SpendView> findByHouseholdIdOrderByStartDateDesc(UUID householdId);

    @Modifying
    @Transactional
    @Query("DELETE FROM SpendView v WHERE v.household.id = :householdId")
    void deleteAllByHouseholdId(@Param("householdId") UUID householdId);
}
