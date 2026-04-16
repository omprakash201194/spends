package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.SpendView;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ViewRepository extends JpaRepository<SpendView, UUID> {
    List<SpendView> findByHouseholdIdOrderByStartDateDesc(UUID householdId);
}
