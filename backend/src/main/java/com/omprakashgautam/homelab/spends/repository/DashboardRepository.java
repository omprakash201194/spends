package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.Dashboard;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DashboardRepository extends JpaRepository<Dashboard, UUID> {
    List<Dashboard> findByUserIdOrderByCreatedAtAsc(UUID userId);
    Optional<Dashboard> findByIdAndUserId(UUID id, UUID userId);
}
