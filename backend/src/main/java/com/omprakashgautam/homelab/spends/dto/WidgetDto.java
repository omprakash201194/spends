package com.omprakashgautam.homelab.spends.dto;

import com.omprakashgautam.homelab.spends.model.DashboardWidget.FilterType;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.Metric;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.WidgetType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
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
            @NotBlank String color,
            UUID accountId,                       // nullable
            LocalDate customFrom,                 // nullable
            LocalDate customTo                    // nullable; requires customFrom
    ) {}

    public record UpdateRequest(
            @NotBlank String title,
            @NotNull WidgetType widgetType,
            @NotNull FilterType filterType,
            String filterValue,
            @NotNull Metric metric,
            @Min(0) @Max(24) int periodMonths,   // 0 = all time
            @NotBlank String color,
            UUID accountId,
            LocalDate customFrom,
            LocalDate customTo
    ) {}

    public record PreviewRequest(
            @NotNull WidgetType widgetType,
            @NotNull FilterType filterType,
            String filterValue,
            @NotNull Metric metric,
            @Min(0) @Max(24) int periodMonths,
            String color,
            UUID accountId,
            LocalDate customFrom,
            LocalDate customTo
    ) {}

    public record MoveRequest(@Min(0) int position) {}

    /** Single layout entry sent in a batch when user drags/resizes the grid. */
    public record LayoutItem(
            @NotNull UUID id,
            @Min(0) int gridX,
            @Min(0) int gridY,
            @Min(1) int gridW,
            @Min(1) int gridH
    ) {}

    public record LayoutBatchRequest(@NotNull List<LayoutItem> items) {}

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
            int position,
            int gridX,
            int gridY,
            int gridW,
            int gridH,
            UUID accountId,
            LocalDate customFrom,
            LocalDate customTo
    ) {}

    /** One slice in a pie/bar chart — categoryId is set when this slice represents a category (null for TAG-filter widgets). */
    public record DataSlice(UUID categoryId, String label, String color, BigDecimal value) {}

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
