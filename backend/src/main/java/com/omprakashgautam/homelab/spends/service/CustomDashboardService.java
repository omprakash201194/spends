package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.CustomDashboardDto;
import com.omprakashgautam.homelab.spends.model.BankAccount;
import com.omprakashgautam.homelab.spends.model.Dashboard;
import com.omprakashgautam.homelab.spends.model.DashboardWidget;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.DashboardRepository;
import com.omprakashgautam.homelab.spends.repository.DashboardWidgetRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CustomDashboardService {

    private final DashboardRepository dashboardRepo;
    private final DashboardWidgetRepository widgetRepo;
    private final UserRepository userRepo;

    @Transactional(readOnly = true)
    public List<CustomDashboardDto.DashboardResponse> getDashboards(UUID userId) {
        return dashboardRepo.findByUserIdOrderByCreatedAtAsc(userId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public CustomDashboardDto.DashboardResponse getDashboard(UUID id, UUID userId) {
        return toResponse(getOwned(id, userId));
    }

    @Transactional
    public CustomDashboardDto.DashboardResponse createDashboard(UUID userId, CustomDashboardDto.CreateRequest req) {
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        Dashboard d = Dashboard.builder().user(user).name(req.name()).build();
        return toResponse(dashboardRepo.save(d));
    }

    @Transactional
    public CustomDashboardDto.DashboardResponse renameDashboard(UUID id, UUID userId, CustomDashboardDto.RenameRequest req) {
        Dashboard d = getOwned(id, userId);
        d.setName(req.name());
        return toResponse(dashboardRepo.save(d));
    }

    @Transactional
    public CustomDashboardDto.DashboardResponse updateFilters(UUID id, UUID userId, CustomDashboardDto.UpdateFiltersRequest req) {
        validateRange(req.customFrom(), req.customTo());
        Dashboard d = getOwned(id, userId);
        d.setAccount(req.accountId() != null ? BankAccount.builder().id(req.accountId()).build() : null);
        d.setPeriodMonths(req.periodMonths());
        d.setCustomFrom(req.customFrom());
        d.setCustomTo(req.customTo());
        return toResponse(dashboardRepo.save(d));
    }

    @Transactional
    public void deleteDashboard(UUID id, UUID userId) {
        getOwned(id, userId);
        dashboardRepo.deleteById(id);
    }

    @Transactional
    public CustomDashboardDto.DashboardResponse duplicateDashboard(UUID id, UUID userId) {
        Dashboard src = getOwned(id, userId);
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        Dashboard copy = Dashboard.builder()
                .user(user)
                .name(src.getName() + " (copy)")
                .account(src.getAccount())
                .periodMonths(src.getPeriodMonths())
                .customFrom(src.getCustomFrom())
                .customTo(src.getCustomTo())
                .build();
        Dashboard saved = dashboardRepo.save(copy);

        List<DashboardWidget> widgets = widgetRepo.findByDashboardIdOrderByPositionAsc(src.getId());
        int pos = 0;
        for (DashboardWidget w : widgets) {
            DashboardWidget cloned = DashboardWidget.builder()
                    .user(user)
                    .dashboard(saved)
                    .title(w.getTitle())
                    .widgetType(w.getWidgetType())
                    .filterType(w.getFilterType())
                    .filterValue(w.getFilterValue())
                    .metric(w.getMetric())
                    .periodMonths(w.getPeriodMonths())
                    .color(w.getColor())
                    .position(pos++)
                    .gridX(w.getGridX())
                    .gridY(w.getGridY())
                    .gridW(w.getGridW())
                    .gridH(w.getGridH())
                    .account(w.getAccount())
                    .customFrom(w.getCustomFrom())
                    .customTo(w.getCustomTo())
                    .build();
            widgetRepo.save(cloned);
        }
        return toResponse(saved);
    }

    private void validateRange(LocalDate from, LocalDate to) {
        if (to != null && from == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "customTo requires customFrom");
        }
        if (from != null && to != null && from.isAfter(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "customFrom must be on or before customTo");
        }
    }

    Dashboard getOwned(UUID id, UUID userId) {
        return dashboardRepo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dashboard not found"));
    }

    private CustomDashboardDto.DashboardResponse toResponse(Dashboard d) {
        return new CustomDashboardDto.DashboardResponse(
                d.getId(),
                d.getName(),
                d.getAccount() != null ? d.getAccount().getId() : null,
                d.getPeriodMonths(),
                d.getCustomFrom(),
                d.getCustomTo(),
                d.getCreatedAt());
    }
}
