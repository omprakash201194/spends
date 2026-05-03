package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.CustomDashboardDto;
import com.omprakashgautam.homelab.spends.dto.WidgetDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.CustomDashboardService;
import com.omprakashgautam.homelab.spends.service.WidgetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/dashboards")
@RequiredArgsConstructor
public class CustomDashboardController {

    private final CustomDashboardService dashboardService;
    private final WidgetService widgetService;

    // ── Dashboard CRUD ────────────────────────────────────────────────────────

    @GetMapping
    public List<CustomDashboardDto.DashboardResponse> getDashboards(
            @AuthenticationPrincipal UserDetailsImpl user) {
        return dashboardService.getDashboards(user.getId());
    }

    @GetMapping("/{id}")
    public CustomDashboardDto.DashboardResponse getDashboard(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetailsImpl user) {
        return dashboardService.getDashboard(id, user.getId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CustomDashboardDto.DashboardResponse createDashboard(
            @AuthenticationPrincipal UserDetailsImpl user,
            @Valid @RequestBody CustomDashboardDto.CreateRequest req) {
        return dashboardService.createDashboard(user.getId(), req);
    }

    @PatchMapping("/{id}")
    public CustomDashboardDto.DashboardResponse renameDashboard(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetailsImpl user,
            @Valid @RequestBody CustomDashboardDto.RenameRequest req) {
        return dashboardService.renameDashboard(id, user.getId(), req);
    }

    @PatchMapping("/{id}/filters")
    public CustomDashboardDto.DashboardResponse updateFilters(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetailsImpl user,
            @Valid @RequestBody CustomDashboardDto.UpdateFiltersRequest req) {
        return dashboardService.updateFilters(id, user.getId(), req);
    }

    @PostMapping("/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public CustomDashboardDto.DashboardResponse duplicateDashboard(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetailsImpl user) {
        return dashboardService.duplicateDashboard(id, user.getId());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDashboard(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetailsImpl user) {
        dashboardService.deleteDashboard(id, user.getId());
    }

    // ── Widgets within a dashboard ────────────────────────────────────────────

    @GetMapping("/{dashboardId}/widgets")
    public List<WidgetDto.WidgetResponse> getWidgets(
            @PathVariable UUID dashboardId,
            @AuthenticationPrincipal UserDetailsImpl user) {
        return widgetService.getWidgets(dashboardId, user.getId());
    }

    @PostMapping("/{dashboardId}/widgets")
    @ResponseStatus(HttpStatus.CREATED)
    public WidgetDto.WidgetResponse createWidget(
            @PathVariable UUID dashboardId,
            @AuthenticationPrincipal UserDetailsImpl user,
            @Valid @RequestBody WidgetDto.CreateRequest req) {
        return widgetService.createWidget(dashboardId, user.getId(), req);
    }
}
