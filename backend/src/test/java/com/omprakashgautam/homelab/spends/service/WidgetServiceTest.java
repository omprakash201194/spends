package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.WidgetDto;
import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.DashboardWidget;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.FilterType;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.Metric;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.WidgetType;
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
import com.omprakashgautam.homelab.spends.repository.DashboardWidgetRepository;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
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
    @Mock TransactionRepository txRepo;
    @Mock CategoryRepository categoryRepo;
    @Mock UserRepository userRepo;
    @InjectMocks WidgetService widgetService;

    @Test
    void getWidgets_returnsUserWidgetsInOrder() {
        UUID userId = UUID.randomUUID();
        DashboardWidget w = DashboardWidget.builder()
                .id(UUID.randomUUID()).title("My Pie")
                .widgetType(WidgetType.PIE).filterType(FilterType.ALL)
                .metric(Metric.SPEND).periodMonths(3).color("#f00").position(0).build();
        when(widgetRepo.findByUserIdOrderByPositionAsc(userId)).thenReturn(List.of(w));

        List<WidgetDto.WidgetResponse> result = widgetService.getWidgets(userId);

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
        List<Object[]> breakdownRows = new ArrayList<>();
        breakdownRows.add(new Object[]{UUID.randomUUID(), "Food & Dining", "#f97316", BigDecimal.valueOf(5000)});
        when(txRepo.categoryBreakdownAll(eq(userId), any(), any())).thenReturn(breakdownRows);

        WidgetDto.WidgetData data = widgetService.getWidgetData(widgetId, userId);

        assertThat(data.slices()).hasSize(1);
        assertThat(data.slices().get(0).label()).isEqualTo("Food & Dining");
        assertThat(data.slices().get(0).value()).isEqualByComparingTo(BigDecimal.valueOf(5000));
        verify(txRepo, never()).categoryBreakdownForIds(any(), any(), any(), any());
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
        when(categoryRepo.findAll()).thenReturn(List.of(root, child));
        List<Object[]> categoryRows = new ArrayList<>();
        categoryRows.add(new Object[]{rootCatId, "Food", "#f97316", BigDecimal.valueOf(2000)});
        categoryRows.add(new Object[]{childCatId, "Restaurants", "#f97316", BigDecimal.valueOf(3000)});
        when(txRepo.categoryBreakdownForIds(eq(userId), any(), any(),
                argThat(ids -> ids.size() == 2 && ids.containsAll(List.of(rootCatId, childCatId)))))
                .thenReturn(categoryRows);

        WidgetDto.WidgetData data = widgetService.getWidgetData(widgetId, userId);

        assertThat(data.slices()).hasSize(2);
        verify(txRepo).categoryBreakdownForIds(eq(userId), any(), any(),
                argThat(ids -> ids.containsAll(List.of(rootCatId, childCatId))));
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
        List<Object[]> trendRows = new ArrayList<>();
        trendRows.add(new Object[]{"2026-01", BigDecimal.valueOf(10000), BigDecimal.valueOf(50000), 45L});
        trendRows.add(new Object[]{"2026-02", BigDecimal.valueOf(12000), BigDecimal.valueOf(50000), 50L});
        when(txRepo.monthlyTrendAll(eq(userId), any(), any())).thenReturn(trendRows);

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

        WidgetDto.WidgetData data = widgetService.getWidgetData(widgetId, userId);

        assertThat(data.slices()).isEmpty();
        verify(txRepo, never()).categoryBreakdownForIds(any(), any(), any(), any());
    }
}
