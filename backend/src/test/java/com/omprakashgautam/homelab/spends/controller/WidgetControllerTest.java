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

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WidgetControllerTest {

    @Mock
    WidgetService widgetService;

    @InjectMocks
    WidgetController controller;

    private UserDetailsImpl principal;
    private UUID userId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        Household household = Household.builder()
                .id(UUID.randomUUID())
                .name("Test Household")
                .inviteCode("TEST1234")
                .maxCategoryDepth(5)
                .build();
        User user = User.builder()
                .id(userId)
                .household(household)
                .username("testuser")
                .email("test@example.com")
                .passwordHash("hash")
                .displayName("Test User")
                .role(Role.MEMBER)
                .build();
        principal = UserDetailsImpl.build(user);
    }

    @Test
    void getWidgets_returnsListFromService() {
        UUID widgetId = UUID.randomUUID();
        WidgetDto.WidgetResponse response = new WidgetDto.WidgetResponse(
                widgetId, "Monthly Spend", WidgetType.PIE,
                FilterType.ALL, null, Metric.SPEND, 3, "#4287f5", 0);
        when(widgetService.getWidgets(userId)).thenReturn(List.of(response));

        List<WidgetDto.WidgetResponse> result = controller.getWidgets(principal);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).id()).isEqualTo(widgetId);
        assertThat(result.get(0).title()).isEqualTo("Monthly Spend");
        verify(widgetService).getWidgets(userId);
    }

    @Test
    void getWidgets_emptyList_returnsEmptyList() {
        when(widgetService.getWidgets(userId)).thenReturn(List.of());

        List<WidgetDto.WidgetResponse> result = controller.getWidgets(principal);

        assertThat(result).isEmpty();
        verify(widgetService).getWidgets(userId);
    }

    @Test
    void createWidget_delegatesToServiceAndReturnsResponse() {
        WidgetDto.CreateRequest req = new WidgetDto.CreateRequest(
                "Top Categories", WidgetType.BAR, FilterType.ALL,
                null, Metric.SPEND, 6, "#ff6384");
        UUID newId = UUID.randomUUID();
        WidgetDto.WidgetResponse response = new WidgetDto.WidgetResponse(
                newId, "Top Categories", WidgetType.BAR,
                FilterType.ALL, null, Metric.SPEND, 6, "#ff6384", 0);
        when(widgetService.createWidget(userId, req)).thenReturn(response);

        WidgetDto.WidgetResponse result = controller.createWidget(principal, req);

        assertThat(result.id()).isEqualTo(newId);
        assertThat(result.widgetType()).isEqualTo(WidgetType.BAR);
        verify(widgetService).createWidget(userId, req);
    }

    @Test
    void updateWidget_delegatesToService() {
        UUID widgetId = UUID.randomUUID();
        WidgetDto.UpdateRequest req = new WidgetDto.UpdateRequest(
                "Updated Title", FilterType.ALL, null, Metric.INCOME, 12, "#36a2eb");
        WidgetDto.WidgetResponse response = new WidgetDto.WidgetResponse(
                widgetId, "Updated Title", WidgetType.LINE,
                FilterType.ALL, null, Metric.INCOME, 12, "#36a2eb", 0);
        when(widgetService.updateWidget(widgetId, userId, req)).thenReturn(response);

        WidgetDto.WidgetResponse result = controller.updateWidget(widgetId, principal, req);

        assertThat(result.title()).isEqualTo("Updated Title");
        verify(widgetService).updateWidget(widgetId, userId, req);
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
                new WidgetDto.StatData(java.math.BigDecimal.valueOf(1500), "spend"));
        when(widgetService.getWidgetData(widgetId, userId)).thenReturn(data);

        WidgetDto.WidgetData result = controller.getWidgetData(widgetId, principal);

        assertThat(result.widgetType()).isEqualTo(WidgetType.STAT);
        assertThat(result.stat().label()).isEqualTo("spend");
        verify(widgetService).getWidgetData(widgetId, userId);
    }
}
