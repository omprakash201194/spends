package com.omprakashgautam.homelab.spends.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "dashboard_widget")
@Getter
@Setter
@ToString
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardWidget {

    public enum WidgetType { PIE, BAR, LINE, STAT }
    public enum FilterType { ALL, CATEGORY, TAG }
    public enum Metric     { SPEND, INCOME, COUNT }

    @EqualsAndHashCode.Include
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    private User user;

    @Column(nullable = false, length = 100)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "widget_type", nullable = false, length = 20)
    private WidgetType widgetType;

    @Enumerated(EnumType.STRING)
    @Column(name = "filter_type", nullable = false, length = 20)
    @Builder.Default
    private FilterType filterType = FilterType.ALL;

    /** category UUID string when filterType=CATEGORY, raw tag string when filterType=TAG */
    @Column(name = "filter_value", length = 255)
    private String filterValue;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Metric metric = Metric.SPEND;

    @Column(name = "period_months", nullable = false)
    @Builder.Default
    private int periodMonths = 6;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String color = "#6366f1";

    @Column(nullable = false)
    @Builder.Default
    private int position = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() { createdAt = LocalDateTime.now(); }
}
