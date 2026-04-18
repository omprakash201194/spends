package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.DashboardWidget;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DashboardWidgetRepository extends JpaRepository<DashboardWidget, UUID> {

    List<DashboardWidget> findByUserIdOrderByPositionAsc(UUID userId);

    Optional<DashboardWidget> findByIdAndUserId(UUID id, UUID userId);

    @Query("SELECT COALESCE(MAX(w.position), -1) FROM DashboardWidget w WHERE w.user.id = :userId")
    Integer findMaxPosition(@Param("userId") UUID userId);

    void deleteByIdAndUserId(UUID id, UUID userId);
}
