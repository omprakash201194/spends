package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.WidgetDto;
import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.Dashboard;
import com.omprakashgautam.homelab.spends.model.DashboardWidget;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.FilterType;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.Metric;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.WidgetType;
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
import com.omprakashgautam.homelab.spends.repository.DashboardRepository;
import com.omprakashgautam.homelab.spends.repository.DashboardWidgetRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WidgetServiceTest {

    @Mock DashboardWidgetRepository widgetRepo;
    @Mock DashboardRepository dashboardRepo;
    @Mock TransactionRepository txRepo;
    @Mock CategoryRepository categoryRepo;
    @Mock UserRepository userRepo;
    @InjectMocks WidgetService widgetService;

    @Test
    void getWidgets_returnsWidgetsInDashboard() {
        UUID userId = UUID.randomUUID();
        UUID dashboardId = UUID.randomUUID();
        Dashboard dashboard = Dashboard.builder().id(dashboardId).build();
        DashboardWidget w = DashboardWidget.builder()
                .id(UUID.randomUUID()).title("My Pie").dashboard(dashboard)
                .widgetType(WidgetType.PIE).filterType(FilterType.ALL)
                .metric(Metric.SPEND).periodMonths(3).color("#f00").position(0).build();
        when(dashboardRepo.findByIdAndUserId(dashboardId, userId)).thenReturn(Optional.of(dashboard));
        when(widgetRepo.findByDashboardIdOrderByPositionAsc(dashboardId)).thenReturn(List.of(w));

        List<WidgetDto.WidgetResponse> result = widgetService.getWidgets(dashboardId, userId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).title()).isEqualTo("My Pie");
    }

    @Test
    void getWidgetData_allFilter_usesBroadQueries() {
        UUID userId = UUID.randomUUID();
        UUID widgetId = UUID.randomUUID();
        DashboardWidget w = DashboardWidget.builder()
                .id(widgetId).title("Spend Breakdown")
                .widgetType(WidgetType.PIE).filterType(FilterType.ALL)
                .metric(Metric.SPEND).periodMonths(3).color("#6366f1").position(0).build();
        when(widgetRepo.findByIdAndUserId(widgetId, userId)).thenReturn(Optional.of(w));
        when(txRepo.latestTransactionDate(userId)).thenReturn(LocalDate.of(2026, 1, 31));
        List<Object[]> breakdownRows = new ArrayList<>();
        breakdownRows.add(new Object[]{UUID.randomUUID(), "Food & Dining", "#f97316", BigDecimal.valueOf(5000)});
        when(txRepo.categoryBreakdownAllByAccount(eq(userId), any(), any(), isNull())).thenReturn(breakdownRows);

        WidgetDto.WidgetData data = widgetService.getWidgetData(widgetId, userId);

        assertThat(data.slices()).hasSize(1);
        assertThat(data.slices().get(0).label()).isEqualTo("Food & Dining");
        assertThat(data.slices().get(0).value()).isEqualByComparingTo(BigDecimal.valueOf(5000));
        verify(txRepo, never()).categoryBreakdownForIdsByAccount(any(), any(), any(), any(), any());
    }

    @Test
    void getWidgetData_categoryFilter_expandsSubtree() {
        UUID userId = UUID.randomUUID();
        UUID widgetId = UUID.randomUUID();
        UUID rootCatId = UUID.randomUUID();
        UUID childCatId = UUID.randomUUID();

        Category root = Category.builder().id(rootCatId).name("Food").system(true).build();
        Category child = Category.builder().id(childCatId).name("Restaurants").parent(root).system(true).build();

        DashboardWidget w = DashboardWidget.builder()
                .id(widgetId).title("Food spending")
                .widgetType(WidgetType.BAR).filterType(FilterType.CATEGORY)
                .filterValue(rootCatId.toString())
                .metric(Metric.SPEND).periodMonths(6).color("#f97316").position(0).build();

        when(widgetRepo.findByIdAndUserId(widgetId, userId)).thenReturn(Optional.of(w));
        when(txRepo.latestTransactionDate(userId)).thenReturn(LocalDate.of(2026, 1, 31));
        when(categoryRepo.findAll()).thenReturn(List.of(root, child));
        List<Object[]> categoryRows = new ArrayList<>();
        categoryRows.add(new Object[]{rootCatId, "Food", "#f97316", BigDecimal.valueOf(2000)});
        categoryRows.add(new Object[]{childCatId, "Restaurants", "#f97316", BigDecimal.valueOf(3000)});
        when(txRepo.categoryBreakdownForIdsByAccount(eq(userId), any(), any(),
                argThat(ids -> ids.size() == 2 && ids.containsAll(List.of(rootCatId, childCatId))),
                isNull()))
                .thenReturn(categoryRows);

        WidgetDto.WidgetData data = widgetService.getWidgetData(widgetId, userId);

        assertThat(data.slices()).hasSize(2);
        verify(txRepo).categoryBreakdownForIdsByAccount(eq(userId), any(), any(),
                argThat(ids -> ids.containsAll(List.of(rootCatId, childCatId))),
                isNull());
    }

    @Test
    void getWidgetData_lineMetric_returnsPoints() {
        UUID userId = UUID.randomUUID();
        UUID widgetId = UUID.randomUUID();
        DashboardWidget w = DashboardWidget.builder()
                .id(widgetId).title("Monthly trend")
                .widgetType(WidgetType.LINE).filterType(FilterType.ALL)
                .metric(Metric.SPEND).periodMonths(3).color("#6366f1").position(0).build();
        when(widgetRepo.findByIdAndUserId(widgetId, userId)).thenReturn(Optional.of(w));
        when(txRepo.latestTransactionDate(userId)).thenReturn(LocalDate.of(2026, 1, 31));
        List<Object[]> trendRows = new ArrayList<>();
        trendRows.add(new Object[]{"2026-01", BigDecimal.valueOf(10000), BigDecimal.valueOf(50000), 45L});
        trendRows.add(new Object[]{"2026-02", BigDecimal.valueOf(12000), BigDecimal.valueOf(50000), 50L});
        when(txRepo.monthlyTrendAllByAccount(eq(userId), any(), any(), isNull())).thenReturn(trendRows);

        WidgetDto.WidgetData data = widgetService.getWidgetData(widgetId, userId);

        assertThat(data.points()).hasSize(2);
        assertThat(data.points().get(0).month()).isEqualTo("2026-01");
        assertThat(data.points().get(1).spend()).isEqualByComparingTo(BigDecimal.valueOf(12000));
    }

    @Test
    void getWidgetData_statMetric_returnsTotalSpend() {
        UUID userId = UUID.randomUUID();
        UUID widgetId = UUID.randomUUID();
        DashboardWidget w = DashboardWidget.builder()
                .id(widgetId).title("Total spent this quarter")
                .widgetType(WidgetType.STAT).filterType(FilterType.ALL)
                .metric(Metric.SPEND).periodMonths(3).color("#6366f1").position(0).build();
        when(widgetRepo.findByIdAndUserId(widgetId, userId)).thenReturn(Optional.of(w));
        when(txRepo.latestTransactionDate(userId)).thenReturn(LocalDate.of(2026, 1, 31));
        when(txRepo.sumWithdrawals(eq(userId), any(), any())).thenReturn(BigDecimal.valueOf(45000));

        WidgetDto.WidgetData data = widgetService.getWidgetData(widgetId, userId);

        assertThat(data.stat()).isNotNull();
        assertThat(data.stat().value()).isEqualByComparingTo(BigDecimal.valueOf(45000));
    }

    @Test
    void getWidgetData_emptySubtree_returnsEmptySlices() {
        UUID userId = UUID.randomUUID();
        UUID widgetId = UUID.randomUUID();
        DashboardWidget w = DashboardWidget.builder()
                .id(widgetId).title("Leaf category")
                .widgetType(WidgetType.PIE).filterType(FilterType.CATEGORY)
                .filterValue("not-a-valid-uuid")
                .metric(Metric.SPEND).periodMonths(3).color("#6366f1").position(0).build();
        when(widgetRepo.findByIdAndUserId(widgetId, userId)).thenReturn(Optional.of(w));
        when(txRepo.latestTransactionDate(userId)).thenReturn(LocalDate.of(2026, 1, 31));

        WidgetDto.WidgetData data = widgetService.getWidgetData(widgetId, userId);

        assertThat(data.slices()).isEmpty();
        verify(txRepo, never()).categoryBreakdownForIdsByAccount(any(), any(), any(), any(), any());
    }

    @Test
    void previewWidget_returnsDataWithoutSaving() {
        UUID userId = UUID.randomUUID();
        when(txRepo.latestTransactionDate(userId)).thenReturn(LocalDate.of(2026, 1, 31));
        List<Object[]> rows = new ArrayList<>();
        rows.add(new Object[]{UUID.randomUUID(), "Food", "#f97316", BigDecimal.valueOf(3000)});
        when(txRepo.categoryBreakdownAllByAccount(eq(userId), any(), any(), isNull())).thenReturn(rows);

        WidgetDto.PreviewRequest req = new WidgetDto.PreviewRequest(
                WidgetType.PIE, FilterType.ALL, null, Metric.SPEND, 6, "#6366f1",
                null, null, null);
        WidgetDto.WidgetData data = widgetService.previewWidget(userId, req);

        assertThat(data.slices()).hasSize(1);
        verify(widgetRepo, never()).save(any());
    }

    @Test
    void getWidgetData_withCustomRange_usesProvidedDates() {
        UUID userId = UUID.randomUUID();
        UUID widgetId = UUID.randomUUID();
        UUID dashboardId = UUID.randomUUID();
        DashboardWidget widget = DashboardWidget.builder()
                .id(widgetId)
                .user(com.omprakashgautam.homelab.spends.model.User.builder().id(userId).build())
                .dashboard(Dashboard.builder().id(dashboardId).build())
                .widgetType(WidgetType.PIE)
                .filterType(FilterType.ALL)
                .metric(Metric.SPEND)
                .periodMonths(6)
                .customFrom(LocalDate.of(2020, 1, 1))
                .customTo(LocalDate.of(2020, 12, 31))
                .color("#6366f1")
                .build();
        when(widgetRepo.findByIdAndUserId(widgetId, userId)).thenReturn(Optional.of(widget));
        when(txRepo.latestTransactionDate(userId)).thenReturn(LocalDate.of(2026, 4, 1));
        when(txRepo.categoryBreakdownAllByAccount(eq(userId),
                eq(LocalDate.of(2020, 1, 1)),
                eq(LocalDate.of(2020, 12, 31)),
                isNull()))
                .thenReturn(List.of());

        widgetService.getWidgetData(widgetId, userId);

        verify(txRepo).categoryBreakdownAllByAccount(userId,
                LocalDate.of(2020, 1, 1),
                LocalDate.of(2020, 12, 31),
                null);
    }

    @Test
    void getWidgetData_withCustomFromOnly_resolvesToToday() {
        UUID userId = UUID.randomUUID();
        UUID widgetId = UUID.randomUUID();
        LocalDate from = LocalDate.of(2024, 6, 1);
        DashboardWidget widget = DashboardWidget.builder()
                .id(widgetId)
                .user(com.omprakashgautam.homelab.spends.model.User.builder().id(userId).build())
                .dashboard(Dashboard.builder().id(UUID.randomUUID()).build())
                .widgetType(WidgetType.PIE)
                .filterType(FilterType.ALL)
                .metric(Metric.SPEND)
                .periodMonths(6)
                .customFrom(from)
                .customTo(null)
                .color("#6366f1")
                .build();
        when(widgetRepo.findByIdAndUserId(widgetId, userId)).thenReturn(Optional.of(widget));
        when(txRepo.latestTransactionDate(userId)).thenReturn(LocalDate.of(2026, 4, 1));
        when(txRepo.categoryBreakdownAllByAccount(any(), any(), any(), any()))
                .thenReturn(List.of());

        widgetService.getWidgetData(widgetId, userId);

        org.mockito.ArgumentCaptor<LocalDate> toCaptor = org.mockito.ArgumentCaptor.forClass(LocalDate.class);
        verify(txRepo).categoryBreakdownAllByAccount(eq(userId), eq(from), toCaptor.capture(), isNull());
        assertThat(toCaptor.getValue()).isEqualTo(LocalDate.now());
    }

    @Test
    void getWidgetData_withCustomRangeAndAccount_filtersBoth() {
        UUID userId = UUID.randomUUID();
        UUID widgetId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        com.omprakashgautam.homelab.spends.model.BankAccount account =
                com.omprakashgautam.homelab.spends.model.BankAccount.builder().id(accountId).build();
        DashboardWidget widget = DashboardWidget.builder()
                .id(widgetId)
                .user(com.omprakashgautam.homelab.spends.model.User.builder().id(userId).build())
                .dashboard(Dashboard.builder().id(UUID.randomUUID()).build())
                .widgetType(WidgetType.PIE)
                .filterType(FilterType.ALL)
                .metric(Metric.SPEND)
                .periodMonths(6)
                .customFrom(LocalDate.of(2022, 1, 1))
                .customTo(LocalDate.of(2022, 12, 31))
                .account(account)
                .color("#6366f1")
                .build();
        when(widgetRepo.findByIdAndUserId(widgetId, userId)).thenReturn(Optional.of(widget));
        when(txRepo.latestTransactionDate(userId)).thenReturn(LocalDate.of(2026, 4, 1));
        when(txRepo.categoryBreakdownAllByAccount(any(), any(), any(), any()))
                .thenReturn(List.of());

        widgetService.getWidgetData(widgetId, userId);

        verify(txRepo).categoryBreakdownAllByAccount(userId,
                LocalDate.of(2022, 1, 1),
                LocalDate.of(2022, 12, 31),
                accountId);
    }

    @Test
    void getWidgetData_withCustomRangeAndPeriodMonths_customRangeWins() {
        UUID userId = UUID.randomUUID();
        UUID widgetId = UUID.randomUUID();
        DashboardWidget widget = DashboardWidget.builder()
                .id(widgetId)
                .user(com.omprakashgautam.homelab.spends.model.User.builder().id(userId).build())
                .dashboard(Dashboard.builder().id(UUID.randomUUID()).build())
                .widgetType(WidgetType.PIE)
                .filterType(FilterType.ALL)
                .metric(Metric.SPEND)
                .periodMonths(12)
                .customFrom(LocalDate.of(2019, 3, 1))
                .customTo(LocalDate.of(2019, 9, 30))
                .color("#6366f1")
                .build();
        when(widgetRepo.findByIdAndUserId(widgetId, userId)).thenReturn(Optional.of(widget));
        when(txRepo.latestTransactionDate(userId)).thenReturn(LocalDate.of(2026, 4, 1));
        when(txRepo.categoryBreakdownAllByAccount(any(), any(), any(), any()))
                .thenReturn(List.of());

        widgetService.getWidgetData(widgetId, userId);

        verify(txRepo).categoryBreakdownAllByAccount(userId,
                LocalDate.of(2019, 3, 1),
                LocalDate.of(2019, 9, 30),
                null);
    }

    @Test
    void previewWidget_withCustomRangeAndAccount_routesCorrectly() {
        UUID userId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        WidgetDto.PreviewRequest req = new WidgetDto.PreviewRequest(
                WidgetType.PIE,
                FilterType.ALL,
                null,
                Metric.SPEND,
                6,
                "#6366f1",
                accountId,
                LocalDate.of(2023, 1, 1),
                LocalDate.of(2023, 12, 31));
        when(txRepo.latestTransactionDate(userId)).thenReturn(LocalDate.of(2026, 4, 1));
        when(txRepo.categoryBreakdownAllByAccount(any(), any(), any(), any()))
                .thenReturn(List.of());

        widgetService.previewWidget(userId, req);

        verify(txRepo).categoryBreakdownAllByAccount(userId,
                LocalDate.of(2023, 1, 1),
                LocalDate.of(2023, 12, 31),
                accountId);
    }

    @Test
    void createWidget_withCustomToOnly_throwsBadRequest() {
        UUID userId = UUID.randomUUID();
        UUID dashboardId = UUID.randomUUID();
        WidgetDto.CreateRequest req = new WidgetDto.CreateRequest(
                "Bad", WidgetType.PIE, FilterType.ALL, null,
                Metric.SPEND, 6, "#6366f1",
                null,
                null,
                LocalDate.of(2020, 12, 31));
        when(dashboardRepo.findByIdAndUserId(dashboardId, userId))
                .thenReturn(Optional.of(Dashboard.builder().id(dashboardId).build()));

        org.assertj.core.api.Assertions.assertThatThrownBy(
                () -> widgetService.createWidget(dashboardId, userId, req))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
                .hasMessageContaining("400");
    }

    @Test
    void createWidget_withCustomFromAfterCustomTo_throwsBadRequest() {
        UUID userId = UUID.randomUUID();
        UUID dashboardId = UUID.randomUUID();
        WidgetDto.CreateRequest req = new WidgetDto.CreateRequest(
                "Bad", WidgetType.PIE, FilterType.ALL, null,
                Metric.SPEND, 6, "#6366f1",
                null,
                LocalDate.of(2020, 12, 31),
                LocalDate.of(2020, 1, 1));
        when(dashboardRepo.findByIdAndUserId(dashboardId, userId))
                .thenReturn(Optional.of(Dashboard.builder().id(dashboardId).build()));

        org.assertj.core.api.Assertions.assertThatThrownBy(
                () -> widgetService.createWidget(dashboardId, userId, req))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
                .hasMessageContaining("400");
    }
}
