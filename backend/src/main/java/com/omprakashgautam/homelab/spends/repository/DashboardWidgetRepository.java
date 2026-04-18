package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.DashboardWidget;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DashboardWidgetRepository extends JpaRepository<DashboardWidget, UUID> {

    List<DashboardWidget> findByDashboardIdOrderByPositionAsc(UUID dashboardId);

    Optional<DashboardWidget> findByIdAndUserId(UUID id, UUID userId);

    @Query("SELECT COALESCE(MAX(w.position), -1) FROM DashboardWidget w WHERE w.dashboard.id = :dashboardId")
    Integer findMaxPositionInDashboard(@Param("dashboardId") UUID dashboardId);

    void deleteByIdAndUserId(UUID id, UUID userId);
}
