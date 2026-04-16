package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.SavingsGoal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SavingsGoalRepository extends JpaRepository<SavingsGoal, UUID> {

    List<SavingsGoal> findAllByUserIdOrderByCreatedAtAsc(UUID userId);
}
