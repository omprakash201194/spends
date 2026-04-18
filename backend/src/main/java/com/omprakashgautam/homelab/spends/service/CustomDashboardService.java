package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.CustomDashboardDto;
import com.omprakashgautam.homelab.spends.model.Dashboard;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.DashboardRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CustomDashboardService {

    private final DashboardRepository dashboardRepo;
    private final UserRepository userRepo;

    @Transactional(readOnly = true)
    public List<CustomDashboardDto.DashboardResponse> getDashboards(UUID userId) {
        return dashboardRepo.findByUserIdOrderByCreatedAtAsc(userId)
                .stream().map(this::toResponse).toList();
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
    public void deleteDashboard(UUID id, UUID userId) {
        getOwned(id, userId);
        dashboardRepo.deleteById(id);
    }

    Dashboard getOwned(UUID id, UUID userId) {
        return dashboardRepo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dashboard not found"));
    }

    private CustomDashboardDto.DashboardResponse toResponse(Dashboard d) {
        return new CustomDashboardDto.DashboardResponse(d.getId(), d.getName(), d.getCreatedAt());
    }
}
