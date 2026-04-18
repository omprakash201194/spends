package com.omprakashgautam.homelab.spends.dto;

import com.omprakashgautam.homelab.spends.model.DashboardWidget.FilterType;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.Metric;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.WidgetType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public class WidgetDto {

    public record CreateRequest(
            @NotBlank String title,
            @NotNull WidgetType widgetType,
            @NotNull FilterType filterType,
            String filterValue,
            @NotNull Metric metric,
            @Min(0) @Max(24) int periodMonths,   // 0 = all time
            @NotBlank String color
    ) {}

    public record UpdateRequest(
            @NotBlank String title,
            @NotNull WidgetType widgetType,
            @NotNull FilterType filterType,
            String filterValue,
            @NotNull Metric metric,
            @Min(0) @Max(24) int periodMonths,   // 0 = all time
            @NotBlank String color
    ) {}

    public record PreviewRequest(
            @NotNull WidgetType widgetType,
            @NotNull FilterType filterType,
            String filterValue,
            @NotNull Metric metric,
            @Min(0) @Max(24) int periodMonths,
            String color
    ) {}

    public record MoveRequest(@Min(0) int position) {}

    public record WidgetResponse(
            UUID id,
            UUID dashboardId,
            String title,
            WidgetType widgetType,
            FilterType filterType,
            String filterValue,
            Metric metric,
            int periodMonths,
            String color,
            int position
    ) {}

    /** One slice in a pie/bar chart — row layout matches categoryBreakdownAll/ForIds: [id, name, color, sum] */
    public record DataSlice(String label, String color, BigDecimal value) {}

    /** One point in a line chart — row layout: [month, withdrawal, deposit, count] */
    public record DataPoint(String month, BigDecimal spend, BigDecimal income, long count) {}

    /** Single stat value */
    public record StatData(BigDecimal value, String label) {}

    public record WidgetData(
            WidgetType widgetType,
            Metric metric,
            List<DataSlice> slices,   // PIE and BAR
            List<DataPoint> points,   // LINE
            StatData stat             // STAT
    ) {}
}
