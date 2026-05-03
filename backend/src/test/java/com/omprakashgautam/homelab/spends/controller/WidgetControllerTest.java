package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.WidgetDto;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.FilterType;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.Metric;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.WidgetType;
import com.omprakashgautam.homelab.spends.model.Household;
import com.omprakashgautam.homelab.spends.model.Role;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.WidgetService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WidgetControllerTest {

    @Mock WidgetService widgetService;
    @InjectMocks WidgetController controller;

    private UserDetailsImpl principal;
    private UUID userId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        Household household = Household.builder()
                .id(UUID.randomUUID()).name("Test Household")
                .inviteCode("TEST1234").maxCategoryDepth(5).build();
        User user = User.builder()
                .id(userId).household(household).username("testuser")
                .email("test@example.com").passwordHash("hash")
                .displayName("Test User").role(Role.MEMBER).build();
        principal = UserDetailsImpl.build(user);
    }

    @Test
    void updateWidget_delegatesToService() {
        UUID widgetId = UUID.randomUUID();
        UUID dashboardId = UUID.randomUUID();
        WidgetDto.UpdateRequest req = new WidgetDto.UpdateRequest(
                "Updated Title", WidgetType.LINE, FilterType.ALL, null, Metric.INCOME, 12, "#36a2eb",
                null, null, null);
        WidgetDto.WidgetResponse response = new WidgetDto.WidgetResponse(
                widgetId, dashboardId, "Updated Title", WidgetType.LINE,
                FilterType.ALL, null, Metric.INCOME, 12, "#36a2eb", 0,
                0, 0, 4, 3,
                null, null, null);
        when(widgetService.updateWidget(widgetId, userId, req)).thenReturn(response);

        WidgetDto.WidgetResponse result = controller.updateWidget(widgetId, principal, req);

        assertThat(result.title()).isEqualTo("Updated Title");
        verify(widgetService).updateWidget(widgetId, userId, req);
    }

    @Test
    void duplicateWidget_delegatesToService() {
        UUID widgetId = UUID.randomUUID();
        UUID newId = UUID.randomUUID();
        UUID dashboardId = UUID.randomUUID();
        WidgetDto.WidgetResponse response = new WidgetDto.WidgetResponse(
                newId, dashboardId, "Title (copy)", WidgetType.PIE,
                FilterType.ALL, null, Metric.SPEND, 6, "#6366f1", 1,
                0, 3, 4, 3,
                null, null, null);
        when(widgetService.duplicateWidget(widgetId, userId)).thenReturn(response);

        WidgetDto.WidgetResponse result = controller.duplicateWidget(widgetId, principal);

        assertThat(result.title()).isEqualTo("Title (copy)");
        verify(widgetService).duplicateWidget(widgetId, userId);
    }

    @Test
    void applyLayout_delegatesToService() {
        UUID w1 = UUID.randomUUID();
        UUID w2 = UUID.randomUUID();
        WidgetDto.LayoutBatchRequest req = new WidgetDto.LayoutBatchRequest(java.util.List.of(
                new WidgetDto.LayoutItem(w1, 0, 0, 4, 3),
                new WidgetDto.LayoutItem(w2, 4, 0, 8, 3)));

        controller.applyLayout(principal, req);

        verify(widgetService).applyLayoutBatch(userId, req.items());
    }

    @Test
    void deleteWidget_delegatesToService() {
        UUID widgetId = UUID.randomUUID();

        controller.deleteWidget(widgetId, principal);

        verify(widgetService).deleteWidget(widgetId, userId);
    }

    @Test
    void moveWidget_delegatesPositionToService() {
        UUID widgetId = UUID.randomUUID();
        WidgetDto.MoveRequest req = new WidgetDto.MoveRequest(3);

        controller.moveWidget(widgetId, principal, req);

        verify(widgetService).moveWidget(widgetId, userId, 3);
    }

    @Test
    void getWidgetData_delegatesToService() {
        UUID widgetId = UUID.randomUUID();
        WidgetDto.WidgetData data = new WidgetDto.WidgetData(
                WidgetType.STAT, Metric.SPEND, null, null,
                new WidgetDto.StatData(BigDecimal.valueOf(1500), "spend"));
        when(widgetService.getWidgetData(widgetId, userId)).thenReturn(data);

        WidgetDto.WidgetData result = controller.getWidgetData(widgetId, principal);

        assertThat(result.widgetType()).isEqualTo(WidgetType.STAT);
        assertThat(result.stat().label()).isEqualTo("spend");
        verify(widgetService).getWidgetData(widgetId, userId);
    }

    @Test
    void previewWidget_delegatesToService() {
        WidgetDto.PreviewRequest req = new WidgetDto.PreviewRequest(
                WidgetType.PIE, FilterType.ALL, null, Metric.SPEND, 6, "#6366f1",
                null, null, null);
        WidgetDto.WidgetData data = new WidgetDto.WidgetData(
                WidgetType.PIE, Metric.SPEND, java.util.List.of(), null, null);
        when(widgetService.previewWidget(userId, req)).thenReturn(data);

        WidgetDto.WidgetData result = controller.previewWidget(principal, req);

        assertThat(result.widgetType()).isEqualTo(WidgetType.PIE);
        verify(widgetService).previewWidget(userId, req);
    }
}
