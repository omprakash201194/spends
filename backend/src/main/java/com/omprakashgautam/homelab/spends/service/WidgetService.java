package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.WidgetDto;
import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.Dashboard;
import com.omprakashgautam.homelab.spends.model.DashboardWidget;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.FilterType;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
import com.omprakashgautam.homelab.spends.repository.DashboardRepository;
import com.omprakashgautam.homelab.spends.repository.DashboardWidgetRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
public class WidgetService {

    private final DashboardWidgetRepository widgetRepo;
    private final DashboardRepository dashboardRepo;
    private final TransactionRepository txRepo;
    private final CategoryRepository categoryRepo;
    private final UserRepository userRepo;

    // ── CRUD ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<WidgetDto.WidgetResponse> getWidgets(UUID dashboardId, UUID userId) {
        verifyDashboardOwnership(dashboardId, userId);
        return widgetRepo.findByDashboardIdOrderByPositionAsc(dashboardId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public WidgetDto.WidgetResponse createWidget(UUID dashboardId, UUID userId, WidgetDto.CreateRequest req) {
        Dashboard dashboard = verifyDashboardOwnership(dashboardId, userId);
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        int nextPos = Objects.requireNonNullElse(widgetRepo.findMaxPositionInDashboard(dashboardId), -1) + 1;
        DashboardWidget widget = DashboardWidget.builder()
                .user(user)
                .dashboard(dashboard)
                .title(req.title())
                .widgetType(req.widgetType())
                .filterType(req.filterType())
                .filterValue(req.filterValue())
                .metric(req.metric())
                .periodMonths(req.periodMonths())
                .color(req.color())
                .position(nextPos)
                .build();
        return toResponse(widgetRepo.save(widget));
    }

    @Transactional
    public WidgetDto.WidgetResponse updateWidget(UUID id, UUID userId, WidgetDto.UpdateRequest req) {
        DashboardWidget widget = getOwned(id, userId);
        widget.setTitle(req.title());
        widget.setWidgetType(req.widgetType());
        widget.setFilterType(req.filterType());
        widget.setFilterValue(req.filterValue());
        widget.setMetric(req.metric());
        widget.setPeriodMonths(req.periodMonths());
        widget.setColor(req.color());
        return toResponse(widgetRepo.save(widget));
    }

    @Transactional
    public void deleteWidget(UUID id, UUID userId) {
        getOwned(id, userId);
        widgetRepo.deleteByIdAndUserId(id, userId);
    }

    @Transactional
    public void moveWidget(UUID id, UUID userId, int newPosition) {
        DashboardWidget widget = getOwned(id, userId);
        widget.setPosition(newPosition);
        widgetRepo.save(widget);
    }

    // ── Data computation ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public WidgetDto.WidgetData getWidgetData(UUID id, UUID userId) {
        DashboardWidget widget = getOwned(id, userId);
        LocalDate anchor = txRepo.latestTransactionDate(userId);
        if (anchor == null) return emptyData(widget);
        LocalDate to = anchor;
        LocalDate from = widget.getPeriodMonths() == 0
                ? LocalDate.of(2000, 1, 1)
                : to.minusMonths(widget.getPeriodMonths()).withDayOfMonth(1);

        return switch (widget.getWidgetType()) {
            case PIE, BAR -> buildSliceData(widget, userId, from, to);
            case LINE     -> buildLineData(widget, userId, from, to);
            case STAT     -> buildStatData(widget, userId, from, to);
        };
    }

    @Transactional(readOnly = true)
    public WidgetDto.WidgetData previewWidget(UUID userId, WidgetDto.PreviewRequest req) {
        LocalDate anchor = txRepo.latestTransactionDate(userId);
        DashboardWidget tmp = buildTempWidget(req);
        if (anchor == null) return emptyData(tmp);
        LocalDate to = anchor;
        LocalDate from = req.periodMonths() == 0
                ? LocalDate.of(2000, 1, 1)
                : to.minusMonths(req.periodMonths()).withDayOfMonth(1);

        return switch (req.widgetType()) {
            case PIE, BAR -> buildSliceData(tmp, userId, from, to);
            case LINE     -> buildLineData(tmp, userId, from, to);
            case STAT     -> buildStatData(tmp, userId, from, to);
        };
    }

    private DashboardWidget buildTempWidget(WidgetDto.PreviewRequest req) {
        return DashboardWidget.builder()
                .widgetType(req.widgetType())
                .filterType(req.filterType() != null ? req.filterType() : FilterType.ALL)
                .filterValue(req.filterValue())
                .metric(req.metric() != null ? req.metric() : DashboardWidget.Metric.SPEND)
                .periodMonths(req.periodMonths())
                .color(req.color() != null ? req.color() : "#6366f1")
                .build();
    }

    private WidgetDto.WidgetData emptyData(DashboardWidget w) {
        return switch (w.getWidgetType()) {
            case PIE, BAR -> new WidgetDto.WidgetData(w.getWidgetType(), w.getMetric(), List.of(), null, null);
            case LINE     -> new WidgetDto.WidgetData(w.getWidgetType(), w.getMetric(), null, List.of(), null);
            case STAT     -> new WidgetDto.WidgetData(w.getWidgetType(), w.getMetric(), null, null,
                    new WidgetDto.StatData(BigDecimal.ZERO, w.getMetric().name().toLowerCase()));
        };
    }

    private WidgetDto.WidgetData buildSliceData(DashboardWidget w, UUID userId,
                                                 LocalDate from, LocalDate to) {
        List<Object[]> rows = fetchBreakdown(w, userId, from, to);
        boolean isCount = w.getMetric() == DashboardWidget.Metric.COUNT;
        List<WidgetDto.DataSlice> slices = rows.stream()
                .map(r -> {
                    BigDecimal value = isCount
                            ? BigDecimal.valueOf(((Number) r[3]).longValue())
                            : (BigDecimal) r[3];
                    return new WidgetDto.DataSlice(
                            (String) r[1],
                            r[2] != null ? (String) r[2] : w.getColor(),
                            value);
                })
                .toList();
        return new WidgetDto.WidgetData(w.getWidgetType(), w.getMetric(), slices, null, null);
    }

    private WidgetDto.WidgetData buildLineData(DashboardWidget w, UUID userId,
                                                LocalDate from, LocalDate to) {
        List<Object[]> rows = fetchMonthlyTrend(w, userId, from, to);
        List<WidgetDto.DataPoint> points = rows.stream()
                .map(r -> new WidgetDto.DataPoint(
                        (String) r[0],
                        (BigDecimal) r[1],
                        (BigDecimal) r[2],
                        ((Number) r[3]).longValue()))
                .toList();
        return new WidgetDto.WidgetData(w.getWidgetType(), w.getMetric(), null, points, null);
    }

    private WidgetDto.WidgetData buildStatData(DashboardWidget w, UUID userId,
                                                LocalDate from, LocalDate to) {
        BigDecimal value = switch (w.getMetric()) {
            case SPEND  -> fetchTotalSpend(w, userId, from, to);
            case INCOME -> txRepo.sumDeposits(userId, from, to);
            case COUNT  -> BigDecimal.valueOf(txRepo.countInPeriod(userId, from, to));
        };
        String label = w.getMetric().name().toLowerCase();
        return new WidgetDto.WidgetData(w.getWidgetType(), w.getMetric(), null, null,
                new WidgetDto.StatData(value, label));
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private List<Object[]> fetchBreakdown(DashboardWidget w, UUID userId,
                                           LocalDate from, LocalDate to) {
        DashboardWidget.Metric metric = w.getMetric() != null ? w.getMetric() : DashboardWidget.Metric.SPEND;
        return switch (w.getFilterType()) {
            case ALL -> switch (metric) {
                case SPEND  -> txRepo.categoryBreakdownAll(userId, from, to);
                case INCOME -> txRepo.categoryBreakdownAllIncome(userId, from, to);
                case COUNT  -> txRepo.categoryBreakdownAllCount(userId, from, to);
            };
            case CATEGORY -> {
                Set<UUID> ids = expandCategorySubtree(w.getFilterValue());
                if (ids.isEmpty()) yield List.of();
                yield switch (metric) {
                    case SPEND  -> txRepo.categoryBreakdownForIds(userId, from, to, ids);
                    case INCOME -> txRepo.categoryBreakdownForIdsIncome(userId, from, to, ids);
                    case COUNT  -> txRepo.categoryBreakdownForIdsCount(userId, from, to, ids);
                };
            }
            case TAG -> {
                // TAG breakdown shows total spend as a single labelled slice — no per-tag aggregate query exists yet
                BigDecimal total = txRepo.sumWithdrawals(userId, from, to);
                String tag = w.getFilterValue() != null ? w.getFilterValue() : "tag";
                yield Collections.singletonList(new Object[]{ null, tag, w.getColor(), total });
            }
        };
    }

    private List<Object[]> fetchMonthlyTrend(DashboardWidget w, UUID userId,
                                              LocalDate from, LocalDate to) {
        return switch (w.getFilterType()) {
            // TAG trend uses global monthly data — no per-tag aggregate query exists yet
            case ALL, TAG -> txRepo.monthlyTrendAll(userId, from, to);
            case CATEGORY -> {
                Set<UUID> ids = expandCategorySubtree(w.getFilterValue());
                yield ids.isEmpty() ? List.of() : txRepo.monthlyTrendForIds(userId, from, to, ids);
            }
        };
    }

    private BigDecimal fetchTotalSpend(DashboardWidget w, UUID userId,
                                        LocalDate from, LocalDate to) {
        // TAG total falls through to global sumWithdrawals — no per-tag aggregate query exists yet
        if (w.getFilterType() == FilterType.CATEGORY) {
            Set<UUID> ids = expandCategorySubtree(w.getFilterValue());
            if (ids.isEmpty()) return BigDecimal.ZERO;
            return txRepo.categoryBreakdownForIds(userId, from, to, ids).stream()
                    .map(r -> (BigDecimal) r[3])
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }
        return txRepo.sumWithdrawals(userId, from, to);
    }

    private Set<UUID> expandCategorySubtree(String filterValue) {
        if (filterValue == null || filterValue.isBlank()) return Set.of();
        UUID rootId;
        try { rootId = UUID.fromString(filterValue); }
        catch (IllegalArgumentException e) { return Set.of(); }
        List<Category> all = categoryRepo.findAll();
        Set<UUID> ids = new HashSet<>(CategoryTreeUtils.getDescendantIds(rootId, all));
        ids.add(rootId);
        return ids;
    }

    private Dashboard verifyDashboardOwnership(UUID dashboardId, UUID userId) {
        return dashboardRepo.findByIdAndUserId(dashboardId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dashboard not found"));
    }

    private DashboardWidget getOwned(UUID id, UUID userId) {
        return widgetRepo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Widget not found"));
    }

    private WidgetDto.WidgetResponse toResponse(DashboardWidget w) {
        return new WidgetDto.WidgetResponse(
                w.getId(),
                w.getDashboard() != null ? w.getDashboard().getId() : null,
                w.getTitle(), w.getWidgetType(),
                w.getFilterType(), w.getFilterValue(), w.getMetric(),
                w.getPeriodMonths(), w.getColor(), w.getPosition());
    }
}
