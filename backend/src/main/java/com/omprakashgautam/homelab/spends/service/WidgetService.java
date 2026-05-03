package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.WidgetDto;
import com.omprakashgautam.homelab.spends.model.BankAccount;
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
        validateCustomRange(req.customFrom(), req.customTo());
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        BankAccount account = req.accountId() != null
                ? BankAccount.builder().id(req.accountId()).build()
                : null;
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
                .account(account)
                .customFrom(req.customFrom())
                .customTo(req.customTo())
                .build();
        return toResponse(widgetRepo.save(widget));
    }

    @Transactional
    public WidgetDto.WidgetResponse updateWidget(UUID id, UUID userId, WidgetDto.UpdateRequest req) {
        validateCustomRange(req.customFrom(), req.customTo());
        DashboardWidget widget = getOwned(id, userId);
        widget.setTitle(req.title());
        widget.setWidgetType(req.widgetType());
        widget.setFilterType(req.filterType());
        widget.setFilterValue(req.filterValue());
        widget.setMetric(req.metric());
        widget.setPeriodMonths(req.periodMonths());
        widget.setColor(req.color());
        widget.setAccount(req.accountId() != null
                ? BankAccount.builder().id(req.accountId()).build()
                : null);
        widget.setCustomFrom(req.customFrom());
        widget.setCustomTo(req.customTo());
        return toResponse(widgetRepo.save(widget));
    }

    private void validateCustomRange(LocalDate from, LocalDate to) {
        if (to != null && from == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "customTo requires customFrom");
        }
        if (from != null && to != null && from.isAfter(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "customFrom must be on or before customTo");
        }
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
        if (anchor == null && widget.getCustomFrom() == null) return emptyData(widget);

        LocalDate from, to;
        if (widget.getCustomFrom() != null) {
            from = widget.getCustomFrom();
            to   = widget.getCustomTo() != null ? widget.getCustomTo() : LocalDate.now();
        } else if (widget.getPeriodMonths() == 0) {
            from = LocalDate.of(2000, 1, 1);
            to   = anchor;
        } else {
            from = anchor.minusMonths(widget.getPeriodMonths()).withDayOfMonth(1);
            to   = anchor;
        }

        return switch (widget.getWidgetType()) {
            case PIE, BAR -> buildSliceData(widget, userId, from, to);
            case LINE     -> buildLineData(widget, userId, from, to);
            case STAT     -> buildStatData(widget, userId, from, to);
        };
    }

    @Transactional(readOnly = true)
    public WidgetDto.WidgetData previewWidget(UUID userId, WidgetDto.PreviewRequest req) {
        validateCustomRange(req.customFrom(), req.customTo());
        LocalDate anchor = txRepo.latestTransactionDate(userId);
        DashboardWidget tmp = buildTempWidget(req);
        if (anchor == null && tmp.getCustomFrom() == null) return emptyData(tmp);

        LocalDate from, to;
        if (tmp.getCustomFrom() != null) {
            from = tmp.getCustomFrom();
            to   = tmp.getCustomTo() != null ? tmp.getCustomTo() : LocalDate.now();
        } else if (tmp.getPeriodMonths() == 0) {
            from = LocalDate.of(2000, 1, 1);
            to   = anchor;
        } else {
            from = anchor.minusMonths(tmp.getPeriodMonths()).withDayOfMonth(1);
            to   = anchor;
        }

        return switch (req.widgetType()) {
            case PIE, BAR -> buildSliceData(tmp, userId, from, to);
            case LINE     -> buildLineData(tmp, userId, from, to);
            case STAT     -> buildStatData(tmp, userId, from, to);
        };
    }

    private DashboardWidget buildTempWidget(WidgetDto.PreviewRequest req) {
        BankAccount account = req.accountId() != null
                ? BankAccount.builder().id(req.accountId()).build()
                : null;
        return DashboardWidget.builder()
                .widgetType(req.widgetType())
                .filterType(req.filterType() != null ? req.filterType() : FilterType.ALL)
                .filterValue(req.filterValue())
                .metric(req.metric() != null ? req.metric() : DashboardWidget.Metric.SPEND)
                .periodMonths(req.periodMonths())
                .color(req.color() != null ? req.color() : "#6366f1")
                .account(account)
                .customFrom(req.customFrom())
                .customTo(req.customTo())
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
        UUID accountId = w.getAccount() != null ? w.getAccount().getId() : null;
        BigDecimal value = switch (w.getMetric()) {
            case SPEND  -> fetchTotalSpend(w, userId, from, to);
            case INCOME -> accountId != null
                    ? txRepo.sumDepositsFiltered(userId, from, to, accountId)
                    : txRepo.sumDeposits(userId, from, to);
            case COUNT  -> accountId != null
                    ? BigDecimal.valueOf(txRepo.countInPeriodFiltered(userId, from, to, accountId))
                    : BigDecimal.valueOf(txRepo.countInPeriod(userId, from, to));
        };
        String label = w.getMetric().name().toLowerCase();
        return new WidgetDto.WidgetData(w.getWidgetType(), w.getMetric(), null, null,
                new WidgetDto.StatData(value, label));
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private List<Object[]> fetchBreakdown(DashboardWidget w, UUID userId,
                                           LocalDate from, LocalDate to) {
        DashboardWidget.Metric metric = w.getMetric() != null ? w.getMetric() : DashboardWidget.Metric.SPEND;
        UUID accountId = w.getAccount() != null ? w.getAccount().getId() : null;
        return switch (w.getFilterType()) {
            case ALL -> switch (metric) {
                case SPEND  -> txRepo.categoryBreakdownAllByAccount(userId, from, to, accountId);
                case INCOME -> txRepo.categoryBreakdownAllIncomeByAccount(userId, from, to, accountId);
                case COUNT  -> txRepo.categoryBreakdownAllCountByAccount(userId, from, to, accountId);
            };
            case CATEGORY -> {
                Set<UUID> ids = expandCategorySubtree(w.getFilterValue());
                if (ids.isEmpty()) yield List.of();
                yield switch (metric) {
                    case SPEND  -> txRepo.categoryBreakdownForIdsByAccount(userId, from, to, ids, accountId);
                    case INCOME -> txRepo.categoryBreakdownForIdsIncomeByAccount(userId, from, to, ids, accountId);
                    case COUNT  -> txRepo.categoryBreakdownForIdsCountByAccount(userId, from, to, ids, accountId);
                };
            }
            case TAG -> {
                // TAG breakdown shows total spend as a single labelled slice — no per-tag aggregate query exists yet
                BigDecimal total = accountId != null
                        ? txRepo.sumWithdrawalsFiltered(userId, from, to, accountId)
                        : txRepo.sumWithdrawals(userId, from, to);
                String tag = w.getFilterValue() != null ? w.getFilterValue() : "tag";
                yield Collections.singletonList(new Object[]{ null, tag, w.getColor(), total });
            }
        };
    }

    private List<Object[]> fetchMonthlyTrend(DashboardWidget w, UUID userId,
                                              LocalDate from, LocalDate to) {
        UUID accountId = w.getAccount() != null ? w.getAccount().getId() : null;
        return switch (w.getFilterType()) {
            // TAG trend uses global monthly data — no per-tag aggregate query exists yet
            case ALL, TAG -> txRepo.monthlyTrendAllByAccount(userId, from, to, accountId);
            case CATEGORY -> {
                Set<UUID> ids = expandCategorySubtree(w.getFilterValue());
                yield ids.isEmpty() ? List.of() : txRepo.monthlyTrendForIdsByAccount(userId, from, to, ids, accountId);
            }
        };
    }

    private BigDecimal fetchTotalSpend(DashboardWidget w, UUID userId,
                                        LocalDate from, LocalDate to) {
        UUID accountId = w.getAccount() != null ? w.getAccount().getId() : null;
        // TAG total falls through to global sumWithdrawals — no per-tag aggregate query exists yet
        if (w.getFilterType() == FilterType.CATEGORY) {
            Set<UUID> ids = expandCategorySubtree(w.getFilterValue());
            if (ids.isEmpty()) return BigDecimal.ZERO;
            return txRepo.categoryBreakdownForIdsByAccount(userId, from, to, ids, accountId).stream()
                    .map(r -> (BigDecimal) r[3])
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }
        return accountId != null
                ? txRepo.sumWithdrawalsFiltered(userId, from, to, accountId)
                : txRepo.sumWithdrawals(userId, from, to);
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
                w.getPeriodMonths(), w.getColor(), w.getPosition(),
                w.getAccount() != null ? w.getAccount().getId() : null,
                w.getCustomFrom(),
                w.getCustomTo());
    }
}
