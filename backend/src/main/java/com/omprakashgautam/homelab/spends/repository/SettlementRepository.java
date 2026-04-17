package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.Settlement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SettlementRepository extends JpaRepository<Settlement, UUID> {
    List<Settlement> findByUserIdOrderByCreatedAtDesc(UUID userId);
}
