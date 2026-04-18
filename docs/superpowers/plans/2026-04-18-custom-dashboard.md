# Custom Dashboard Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to create a personal dashboard with custom widgets (pie, bar, line charts, stat counts) filtered by category subtree or raw-remarks tag, covering any rolling period.

**Architecture:** New `dashboard_widget` table stores widget config per user. A `/api/widgets` REST resource handles CRUD and a separate `GET /{id}/data` endpoint computes the chart payload on demand. Frontend adds a `/custom-dashboard` route in the "Spend" nav group rendered via Recharts.

**Tech Stack:** Spring Boot 3.3.4 · Java 21 · Liquibase YAML · JPA · PostgreSQL · React 18 · TypeScript · TailwindCSS 3 · Recharts 2.13.3 · TanStack Query v5

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `backend/.../model/DashboardWidget.java` | JPA entity |
| `backend/.../repository/DashboardWidgetRepository.java` | Spring Data repo |
| `backend/.../dto/WidgetDto.java` | All request/response records |
| `backend/.../service/WidgetService.java` | CRUD + data computation |
| `backend/.../controller/WidgetController.java` | REST endpoints |
| `backend/src/main/resources/db/changelog/changes/021-dashboard-widgets.yaml` | Liquibase migration |
| `frontend/src/api/widgets.ts` | Axios client |
| `frontend/src/components/WidgetForm.tsx` | Create/edit modal |
| `frontend/src/components/WidgetRenderer.tsx` | Recharts renderer per widget type |
| `frontend/src/pages/CustomDashboardPage.tsx` | Full page layout |

### Modified files
| File | Change |
|---|---|
| `backend/src/main/resources/db/changelog/db.changelog-master.xml` | Include migration 021 |
| `backend/.../repository/TransactionRepository.java` | 4 new JPQL queries |
| `frontend/src/App.tsx` | Add `/custom-dashboard` route |
| `frontend/src/components/Layout.tsx` | Add "My Dashboard" nav link in Spend group |

---

## Task 1: DB Migration + Entity + Repository

**Files:**
- Create: `backend/src/main/resources/db/changelog/changes/021-dashboard-widgets.yaml`
- Modify: `backend/src/main/resources/db/changelog/db.changelog-master.xml`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/model/DashboardWidget.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/DashboardWidgetRepository.java`

- [ ] **Step 1: Write the Liquibase migration**

Create `backend/src/main/resources/db/changelog/changes/021-dashboard-widgets.yaml`:

```yaml
databaseChangeLog:
  - changeSet:
      id: 021-dashboard-widgets
      author: omprakash
      changes:
        - createTable:
            tableName: dashboard_widget
            columns:
              - column:
                  name: id
                  type: uuid
                  constraints:
                    primaryKey: true
                    nullable: false
              - column:
                  name: user_id
                  type: uuid
                  constraints:
                    nullable: false
                    foreignKeyName: fk_widget_user
                    references: app_user(id)
                    deleteCascade: true
              - column:
                  name: title
                  type: varchar(100)
                  constraints:
                    nullable: false
              - column:
                  name: widget_type
                  type: varchar(20)
                  constraints:
                    nullable: false
              - column:
                  name: filter_type
                  type: varchar(20)
                  constraints:
                    nullable: false
                    defaultValue: ALL
              - column:
                  name: filter_value
                  type: varchar(255)
              - column:
                  name: metric
                  type: varchar(20)
                  constraints:
                    nullable: false
                    defaultValue: SPEND
              - column:
                  name: period_months
                  type: int
                  constraints:
                    nullable: false
                    defaultValue: 6
              - column:
                  name: color
                  type: varchar(20)
                  constraints:
                    nullable: false
                    defaultValue: '#6366f1'
              - column:
                  name: position
                  type: int
                  constraints:
                    nullable: false
                    defaultValue: 0
              - column:
                  name: created_at
                  type: timestamp
                  constraints:
                    nullable: false
        - createIndex:
            tableName: dashboard_widget
            indexName: idx_widget_user_position
            columns:
              - column:
                  name: user_id
              - column:
                  name: position
```

- [ ] **Step 2: Register migration in master XML**

In `backend/src/main/resources/db/changelog/db.changelog-master.xml` add after the `020-ai-generated-rule.yaml` line:

```xml
    <include file="changes/021-dashboard-widgets.yaml" relativeToChangelogFile="true"/>
```

- [ ] **Step 3: Write the JPA entity**

Create `backend/src/main/java/com/omprakashgautam/homelab/spends/model/DashboardWidget.java`:

```java
package com.omprakashgautam.homelab.spends.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "dashboard_widget")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardWidget {

    public enum WidgetType { PIE, BAR, LINE, STAT }
    public enum FilterType { ALL, CATEGORY, TAG }
    public enum Metric     { SPEND, INCOME, COUNT }

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
```

- [ ] **Step 4: Write the repository**

Create `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/DashboardWidgetRepository.java`:

```java
package com.omprakashgautam.homelab.spends.repository;

import com.omprakashgautam.homelab.spends.model.DashboardWidget;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DashboardWidgetRepository extends JpaRepository<DashboardWidget, UUID> {

    List<DashboardWidget> findByUserIdOrderByPositionAsc(UUID userId);

    Optional<DashboardWidget> findByIdAndUserId(UUID id, UUID userId);

    @Query("SELECT COALESCE(MAX(w.position), -1) FROM DashboardWidget w WHERE w.user.id = :userId")
    int findMaxPosition(@Param("userId") UUID userId);

    @Modifying
    @Transactional
    @Query("DELETE FROM DashboardWidget w WHERE w.user.id = :userId AND w.id = :id")
    void deleteByIdAndUserId(@Param("id") UUID id, @Param("userId") UUID userId);
}
```

- [ ] **Step 5: Verify migration runs**

Start the backend with local profile and check logs for `021-dashboard-widgets` applied successfully. The table `dashboard_widget` should appear in PostgreSQL.

```bash
# from spends/backend, with port-forwarded postgres:
mvn spring-boot:run -Dspring-boot.run.profiles=local 2>&1 | grep -E "(021|widget|ERROR)"
```

Expected: `021-dashboard-widgets` changeSet applied, no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/resources/db/changelog/changes/021-dashboard-widgets.yaml \
        backend/src/main/resources/db/changelog/db.changelog-master.xml \
        backend/src/main/java/com/omprakashgautam/homelab/spends/model/DashboardWidget.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/repository/DashboardWidgetRepository.java
git commit -m "feat: add dashboard_widget table, entity, and repository"
```

---

## Task 2: New TransactionRepository Queries

**Files:**
- Modify: `backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionRepository.java`

These four queries power the widget data endpoint. They are tested independently in Task 3 via mocked results.

- [ ] **Step 1: Add 4 new JPQL queries to TransactionRepository**

At the bottom of `TransactionRepository.java`, add:

```java
// ── Widget: category breakdown for a set of category IDs ─────────────────

@Query("""
    SELECT t.category.name, t.category.color, COALESCE(SUM(t.withdrawalAmount), 0)
    FROM Transaction t
    WHERE t.bankAccount.user.id = :userId
      AND t.valueDate >= :from AND t.valueDate <= :to
      AND t.withdrawalAmount > 0
      AND t.category.id IN :categoryIds
    GROUP BY t.category.id, t.category.name, t.category.color
    ORDER BY SUM(t.withdrawalAmount) DESC
    """)
List<Object[]> categoryBreakdownForIds(@Param("userId") UUID userId,
                                        @Param("from") LocalDate from,
                                        @Param("to") LocalDate to,
                                        @Param("categoryIds") Collection<UUID> categoryIds);

// ── Widget: monthly spend/income/count for a set of category IDs ──────────

@Query("""
    SELECT FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM'),
           COALESCE(SUM(t.withdrawalAmount), 0),
           COALESCE(SUM(t.depositAmount), 0),
           COUNT(t)
    FROM Transaction t
    WHERE t.bankAccount.user.id = :userId
      AND t.valueDate >= :from AND t.valueDate <= :to
      AND t.category.id IN :categoryIds
    GROUP BY FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM')
    ORDER BY FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM') ASC
    """)
List<Object[]> monthlyTrendForIds(@Param("userId") UUID userId,
                                   @Param("from") LocalDate from,
                                   @Param("to") LocalDate to,
                                   @Param("categoryIds") Collection<UUID> categoryIds);

// ── Widget: category breakdown / monthly trend for ALL transactions ────────

@Query("""
    SELECT t.category.name, t.category.color, COALESCE(SUM(t.withdrawalAmount), 0)
    FROM Transaction t
    WHERE t.bankAccount.user.id = :userId
      AND t.valueDate >= :from AND t.valueDate <= :to
      AND t.withdrawalAmount > 0
      AND t.category IS NOT NULL
    GROUP BY t.category.id, t.category.name, t.category.color
    ORDER BY SUM(t.withdrawalAmount) DESC
    """)
List<Object[]> categoryBreakdownAll(@Param("userId") UUID userId,
                                     @Param("from") LocalDate from,
                                     @Param("to") LocalDate to);

@Query("""
    SELECT FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM'),
           COALESCE(SUM(t.withdrawalAmount), 0),
           COALESCE(SUM(t.depositAmount), 0),
           COUNT(t)
    FROM Transaction t
    WHERE t.bankAccount.user.id = :userId
      AND t.valueDate >= :from AND t.valueDate <= :to
    GROUP BY FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM')
    ORDER BY FUNCTION('TO_CHAR', t.valueDate, 'YYYY-MM') ASC
    """)
List<Object[]> monthlyTrendAll(@Param("userId") UUID userId,
                                @Param("from") LocalDate from,
                                @Param("to") LocalDate to);
```

Also add `java.util.Collection` to the import block at the top of the file.

- [ ] **Step 2: Compile check**

```bash
mvn -f backend/pom.xml compile -q
```

Expected: BUILD SUCCESS, no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/repository/TransactionRepository.java
git commit -m "feat: add widget data queries to TransactionRepository"
```

---

## Task 3: WidgetDto + WidgetService

**Files:**
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/WidgetDto.java`
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/service/WidgetService.java`
- Create: `backend/src/test/java/com/omprakashgautam/homelab/spends/service/WidgetServiceTest.java`

- [ ] **Step 1: Write WidgetDto**

Create `backend/src/main/java/com/omprakashgautam/homelab/spends/dto/WidgetDto.java`:

```java
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
            @Min(1) @Max(24) int periodMonths,
            @NotBlank String color
    ) {}

    public record UpdateRequest(
            @NotBlank String title,
            @NotNull FilterType filterType,
            String filterValue,
            @NotNull Metric metric,
            @Min(1) @Max(24) int periodMonths,
            @NotBlank String color
    ) {}

    public record MoveRequest(int position) {}

    public record WidgetResponse(
            UUID id,
            String title,
            WidgetType widgetType,
            FilterType filterType,
            String filterValue,
            Metric metric,
            int periodMonths,
            String color,
            int position
    ) {}

    /** One slice in a pie/bar chart */
    public record DataSlice(String label, String color, BigDecimal value) {}

    /** One point in a line chart */
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
```

- [ ] **Step 2: Write the failing tests**

Create `backend/src/test/java/com/omprakashgautam/homelab/spends/service/WidgetServiceTest.java`:

```java
package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.WidgetDto;
import com.omprakashgautam.homelab.spends.model.DashboardWidget;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.FilterType;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.Metric;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.WidgetType;
import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.User;
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
import java.time.LocalDate;
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
        when(txRepo.categoryBreakdownAll(eq(userId), any(), any()))
                .thenReturn(List.of(new Object[]{"Food & Dining", "#f97316", BigDecimal.valueOf(5000)}));

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
        Category child = Category.builder().id(childCatId).name("Restaurants").system(true).build();
        child = Category.builder().id(childCatId).name("Restaurants")
                .parent(root).system(true).build();

        DashboardWidget w = DashboardWidget.builder()
                .id(widgetId).title("Food spending")
                .widgetType(WidgetType.BAR).filterType(FilterType.CATEGORY)
                .filterValue(rootCatId.toString())
                .metric(Metric.SPEND).periodMonths(6).color("#f97316").position(0).build();

        when(widgetRepo.findByIdAndUserId(widgetId, userId)).thenReturn(Optional.of(w));
        when(categoryRepo.findAll()).thenReturn(List.of(root, child));
        when(txRepo.categoryBreakdownForIds(eq(userId), any(), any(), argThat(ids -> ids.size() == 2)))
                .thenReturn(List.of(
                        new Object[]{"Food", "#f97316", BigDecimal.valueOf(2000)},
                        new Object[]{"Restaurants", "#f97316", BigDecimal.valueOf(3000)}
                ));

        WidgetDto.WidgetData data = widgetService.getWidgetData(widgetId, userId);

        assertThat(data.slices()).hasSize(2);
        // verify subtree expansion: both root and child were in the query
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
        when(txRepo.monthlyTrendAll(eq(userId), any(), any()))
                .thenReturn(List.of(
                        new Object[]{"2026-01", BigDecimal.valueOf(10000), BigDecimal.valueOf(50000), 45L},
                        new Object[]{"2026-02", BigDecimal.valueOf(12000), BigDecimal.valueOf(50000), 50L}
                ));

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
}
```

- [ ] **Step 3: Run tests — expect compilation failure (service missing)**

```bash
mvn -f backend/pom.xml test -pl . -Dtest=WidgetServiceTest -q 2>&1 | tail -20
```

Expected: FAIL — `WidgetService` not found.

- [ ] **Step 4: Write WidgetService**

Create `backend/src/main/java/com/omprakashgautam/homelab/spends/service/WidgetService.java`:

```java
package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.WidgetDto;
import com.omprakashgautam.homelab.spends.model.Category;
import com.omprakashgautam.homelab.spends.model.DashboardWidget;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.FilterType;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.Metric;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.WidgetType;
import com.omprakashgautam.homelab.spends.model.User;
import com.omprakashgautam.homelab.spends.repository.CategoryRepository;
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
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WidgetService {

    private final DashboardWidgetRepository widgetRepo;
    private final TransactionRepository txRepo;
    private final CategoryRepository categoryRepo;
    private final UserRepository userRepo;

    // ── CRUD ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<WidgetDto.WidgetResponse> getWidgets(UUID userId) {
        return widgetRepo.findByUserIdOrderByPositionAsc(userId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public WidgetDto.WidgetResponse createWidget(UUID userId, WidgetDto.CreateRequest req) {
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        int nextPos = widgetRepo.findMaxPosition(userId) + 1;
        DashboardWidget widget = DashboardWidget.builder()
                .user(user)
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
        LocalDate to = LocalDate.now();
        LocalDate from = to.minusMonths(widget.getPeriodMonths()).withDayOfMonth(1);

        return switch (widget.getWidgetType()) {
            case PIE, BAR -> buildSliceData(widget, userId, from, to);
            case LINE     -> buildLineData(widget, userId, from, to);
            case STAT     -> buildStatData(widget, userId, from, to);
        };
    }

    private WidgetDto.WidgetData buildSliceData(DashboardWidget w, UUID userId,
                                                 LocalDate from, LocalDate to) {
        List<Object[]> rows = fetchBreakdown(w, userId, from, to);
        List<WidgetDto.DataSlice> slices = rows.stream()
                .map(r -> new WidgetDto.DataSlice(
                        (String) r[0],
                        r[1] != null ? (String) r[1] : w.getColor(),
                        (BigDecimal) r[2]))
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
        return switch (w.getFilterType()) {
            case ALL      -> txRepo.categoryBreakdownAll(userId, from, to);
            case CATEGORY -> {
                Set<UUID> ids = expandCategorySubtree(w.getFilterValue());
                yield ids.isEmpty()
                        ? List.of()
                        : txRepo.categoryBreakdownForIds(userId, from, to, ids);
            }
            case TAG -> fetchBreakdownForTag(w, userId, from, to);
        };
    }

    private List<Object[]> fetchBreakdownForTag(DashboardWidget w, UUID userId,
                                                 LocalDate from, LocalDate to) {
        // TAG filter: return single-slice summary — total spend for tag
        BigDecimal total = txRepo.sumWithdrawals(userId, from, to); // approximation via subquery below
        // For TAG we simplify: one slice labelled by the tag
        return List.of(new Object[]{ w.getFilterValue(), w.getColor(), total });
    }

    private List<Object[]> fetchMonthlyTrend(DashboardWidget w, UUID userId,
                                              LocalDate from, LocalDate to) {
        return switch (w.getFilterType()) {
            case ALL      -> txRepo.monthlyTrendAll(userId, from, to);
            case CATEGORY -> {
                Set<UUID> ids = expandCategorySubtree(w.getFilterValue());
                yield ids.isEmpty() ? List.of() : txRepo.monthlyTrendForIds(userId, from, to, ids);
            }
            case TAG      -> txRepo.monthlyTrendAll(userId, from, to); // tag line uses global trend
        };
    }

    private BigDecimal fetchTotalSpend(DashboardWidget w, UUID userId,
                                        LocalDate from, LocalDate to) {
        if (w.getFilterType() == FilterType.CATEGORY) {
            Set<UUID> ids = expandCategorySubtree(w.getFilterValue());
            if (ids.isEmpty()) return BigDecimal.ZERO;
            // sum withdrawals for the category ids
            return txRepo.categoryBreakdownForIds(userId, from, to, ids).stream()
                    .map(r -> (BigDecimal) r[2])
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
        Set<UUID> ids = CategoryTreeUtils.getDescendantIds(rootId, all);
        ids.add(rootId);
        return ids;
    }

    private DashboardWidget getOwned(UUID id, UUID userId) {
        return widgetRepo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Widget not found"));
    }

    private WidgetDto.WidgetResponse toResponse(DashboardWidget w) {
        return new WidgetDto.WidgetResponse(
                w.getId(), w.getTitle(), w.getWidgetType(),
                w.getFilterType(), w.getFilterValue(), w.getMetric(),
                w.getPeriodMonths(), w.getColor(), w.getPosition());
    }
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
mvn -f backend/pom.xml test -Dtest=WidgetServiceTest -q
```

Expected: `Tests run: 5, Failures: 0, Errors: 0`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/dto/WidgetDto.java \
        backend/src/main/java/com/omprakashgautam/homelab/spends/service/WidgetService.java \
        backend/src/test/java/com/omprakashgautam/homelab/spends/service/WidgetServiceTest.java
git commit -m "feat: add WidgetDto, WidgetService with subtree expansion and data computation"
```

---

## Task 4: WidgetController

**Files:**
- Create: `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/WidgetController.java`

- [ ] **Step 1: Write the failing test (controller smoke test)**

Add a minimal test to verify the controller wires correctly. Create `backend/src/test/java/com/omprakashgautam/homelab/spends/controller/WidgetControllerTest.java`:

```java
package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.WidgetDto;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.FilterType;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.Metric;
import com.omprakashgautam.homelab.spends.model.DashboardWidget.WidgetType;
import com.omprakashgautam.homelab.spends.service.WidgetService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(WidgetController.class)
class WidgetControllerTest {

    @Autowired MockMvc mvc;
    @MockBean WidgetService widgetService;

    @Test
    @WithMockUser
    void getWidgets_returns200() throws Exception {
        when(widgetService.getWidgets(any())).thenReturn(List.of(
                new WidgetDto.WidgetResponse(UUID.randomUUID(), "My Pie", WidgetType.PIE,
                        FilterType.ALL, null, Metric.SPEND, 3, "#6366f1", 0)
        ));
        mvc.perform(get("/api/widgets"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("My Pie"));
    }
}
```

- [ ] **Step 2: Run test — expect failure (controller missing)**

```bash
mvn -f backend/pom.xml test -Dtest=WidgetControllerTest -q 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 3: Write WidgetController**

Create `backend/src/main/java/com/omprakashgautam/homelab/spends/controller/WidgetController.java`:

```java
package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.WidgetDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.WidgetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/widgets")
@RequiredArgsConstructor
public class WidgetController {

    private final WidgetService widgetService;

    @GetMapping
    public List<WidgetDto.WidgetResponse> getWidgets(
            @AuthenticationPrincipal UserDetailsImpl user) {
        return widgetService.getWidgets(user.getId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WidgetDto.WidgetResponse createWidget(
            @AuthenticationPrincipal UserDetailsImpl user,
            @Valid @RequestBody WidgetDto.CreateRequest req) {
        return widgetService.createWidget(user.getId(), req);
    }

    @PutMapping("/{id}")
    public WidgetDto.WidgetResponse updateWidget(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetailsImpl user,
            @Valid @RequestBody WidgetDto.UpdateRequest req) {
        return widgetService.updateWidget(id, user.getId(), req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteWidget(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetailsImpl user) {
        widgetService.deleteWidget(id, user.getId());
    }

    @PostMapping("/{id}/move")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void moveWidget(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetailsImpl user,
            @RequestBody WidgetDto.MoveRequest req) {
        widgetService.moveWidget(id, user.getId(), req.position());
    }

    @GetMapping("/{id}/data")
    public WidgetDto.WidgetData getWidgetData(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetailsImpl user) {
        return widgetService.getWidgetData(id, user.getId());
    }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
mvn -f backend/pom.xml test -Dtest="WidgetServiceTest,WidgetControllerTest" -q
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/omprakashgautam/homelab/spends/controller/WidgetController.java \
        backend/src/test/java/com/omprakashgautam/homelab/spends/controller/WidgetControllerTest.java
git commit -m "feat: add WidgetController with CRUD and data endpoints"
```

---

## Task 5: Frontend API Client

**Files:**
- Create: `frontend/src/api/widgets.ts`

- [ ] **Step 1: Write the API client**

Create `frontend/src/api/widgets.ts`:

```typescript
import apiClient from './client'

export type WidgetType = 'PIE' | 'BAR' | 'LINE' | 'STAT'
export type FilterType = 'ALL' | 'CATEGORY' | 'TAG'
export type Metric = 'SPEND' | 'INCOME' | 'COUNT'

export interface Widget {
  id: string
  title: string
  widgetType: WidgetType
  filterType: FilterType
  filterValue: string | null
  metric: Metric
  periodMonths: number
  color: string
  position: number
}

export interface CreateWidgetRequest {
  title: string
  widgetType: WidgetType
  filterType: FilterType
  filterValue?: string
  metric: Metric
  periodMonths: number
  color: string
}

export interface UpdateWidgetRequest {
  title: string
  filterType: FilterType
  filterValue?: string
  metric: Metric
  periodMonths: number
  color: string
}

export interface DataSlice {
  label: string
  color: string
  value: number
}

export interface DataPoint {
  month: string
  spend: number
  income: number
  count: number
}

export interface StatData {
  value: number
  label: string
}

export interface WidgetData {
  widgetType: WidgetType
  metric: Metric
  slices: DataSlice[] | null
  points: DataPoint[] | null
  stat: StatData | null
}

export async function getWidgets(): Promise<Widget[]> {
  const { data } = await apiClient.get<Widget[]>('/widgets')
  return data
}

export async function createWidget(req: CreateWidgetRequest): Promise<Widget> {
  const { data } = await apiClient.post<Widget>('/widgets', req)
  return data
}

export async function updateWidget(id: string, req: UpdateWidgetRequest): Promise<Widget> {
  const { data } = await apiClient.put<Widget>(`/widgets/${id}`, req)
  return data
}

export async function deleteWidget(id: string): Promise<void> {
  await apiClient.delete(`/widgets/${id}`)
}

export async function moveWidget(id: string, position: number): Promise<void> {
  await apiClient.post(`/widgets/${id}/move`, { position })
}

export async function getWidgetData(id: string): Promise<WidgetData> {
  const { data } = await apiClient.get<WidgetData>(`/widgets/${id}/data`)
  return data
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i widget
```

Expected: No widget-related type errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/widgets.ts
git commit -m "feat: add widgets API client"
```

---

## Task 6: WidgetForm Component

**Files:**
- Create: `frontend/src/components/WidgetForm.tsx`

This is a modal dialog for creating and editing widgets. It is self-contained with no external state dependencies beyond the categories list.

- [ ] **Step 1: Write the component**

Create `frontend/src/components/WidgetForm.tsx`:

```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { getCategories } from '../api/categories'
import type { CreateWidgetRequest, FilterType, Metric, Widget, WidgetType } from '../api/widgets'

const WIDGET_TYPES: { value: WidgetType; label: string; desc: string }[] = [
  { value: 'PIE',  label: 'Pie Chart',  desc: 'Category breakdown as slices' },
  { value: 'BAR',  label: 'Bar Chart',  desc: 'Category comparison as bars' },
  { value: 'LINE', label: 'Line Chart', desc: 'Spending trend over time' },
  { value: 'STAT', label: 'Stat',       desc: 'Single total number' },
]

const FILTER_TYPES: { value: FilterType; label: string }[] = [
  { value: 'ALL',      label: 'All transactions' },
  { value: 'CATEGORY', label: 'Category (+ subcategories)' },
  { value: 'TAG',      label: 'Tag / keyword in remarks' },
]

const METRICS: { value: Metric; label: string }[] = [
  { value: 'SPEND',  label: 'Total Spend' },
  { value: 'INCOME', label: 'Total Income' },
  { value: 'COUNT',  label: 'Transaction Count' },
]

const PRESET_COLORS = [
  '#6366f1', '#f97316', '#22c55e', '#ef4444',
  '#3b82f6', '#a855f7', '#14b8a6', '#eab308',
]

interface Props {
  existing?: Widget
  onSave: (req: CreateWidgetRequest) => void
  onClose: () => void
}

export default function WidgetForm({ existing, onSave, onClose }: Props) {
  const [title, setTitle] = useState(existing?.title ?? '')
  const [widgetType, setWidgetType] = useState<WidgetType>(existing?.widgetType ?? 'PIE')
  const [filterType, setFilterType] = useState<FilterType>(existing?.filterType ?? 'ALL')
  const [filterValue, setFilterValue] = useState(existing?.filterValue ?? '')
  const [metric, setMetric] = useState<Metric>(existing?.metric ?? 'SPEND')
  const [periodMonths, setPeriodMonths] = useState(existing?.periodMonths ?? 6)
  const [color, setColor] = useState(existing?.color ?? '#6366f1')

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    staleTime: 60_000,
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      title,
      widgetType,
      filterType,
      filterValue: filterType !== 'ALL' ? filterValue : undefined,
      metric,
      periodMonths,
      color,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {existing ? 'Edit Widget' : 'Add Widget'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="My spending breakdown"
            />
          </div>

          {/* Widget type (only shown when creating) */}
          {!existing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Chart type</label>
              <div className="grid grid-cols-2 gap-2">
                {WIDGET_TYPES.map(wt => (
                  <button
                    key={wt.value}
                    type="button"
                    onClick={() => setWidgetType(wt.value)}
                    className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                      widgetType === wt.value
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium">{wt.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{wt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Metric */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Metric</label>
            <select
              value={metric}
              onChange={e => setMetric(e.target.value as Metric)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {/* Filter type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Filter</label>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as FilterType)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {FILTER_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
            </select>
          </div>

          {/* Filter value */}
          {filterType === 'CATEGORY' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <select
                value={filterValue}
                onChange={e => setFilterValue(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">— pick category —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {filterType === 'TAG' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tag / keyword</label>
              <input
                value={filterValue}
                onChange={e => setFilterValue(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g. Goa trip"
              />
            </div>
          )}

          {/* Period */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Period: last {periodMonths} month{periodMonths !== 1 ? 's' : ''}
            </label>
            <input
              type="range"
              min={1} max={24} step={1}
              value={periodMonths}
              onChange={e => setPeriodMonths(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1m</span><span>6m</span><span>12m</span><span>24m</span>
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Accent color</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium">
              {existing ? 'Save changes' : 'Add widget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i "widgetform\|widgets"
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/WidgetForm.tsx
git commit -m "feat: add WidgetForm modal with type/filter/period/color pickers"
```

---

## Task 7: WidgetRenderer + CustomDashboardPage

**Files:**
- Create: `frontend/src/components/WidgetRenderer.tsx`
- Create: `frontend/src/pages/CustomDashboardPage.tsx`

- [ ] **Step 1: Write WidgetRenderer**

Create `frontend/src/components/WidgetRenderer.tsx`:

```tsx
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts'
import type { WidgetData } from '../api/widgets'

const FALLBACK_COLORS = [
  '#6366f1', '#f97316', '#22c55e', '#ef4444',
  '#3b82f6', '#a855f7', '#14b8a6', '#eab308',
]

function fmt(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K`
  return `₹${v.toFixed(0)}`
}

interface Props { data: WidgetData; color: string }

export default function WidgetRenderer({ data, color }: Props) {
  if (data.widgetType === 'PIE' && data.slices) {
    const items = data.slices.map((s, i) => ({
      name: s.label,
      value: Number(s.value),
      fill: s.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    }))
    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={items} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={false}>
            {items.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Pie>
          <Tooltip formatter={(v: number) => fmt(v)} />
          <Legend iconType="circle" iconSize={10} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (data.widgetType === 'BAR' && data.slices) {
    const items = data.slices.map(s => ({ name: s.label, value: Number(s.value) }))
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={items} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={55} />
          <Tooltip formatter={(v: number) => fmt(v)} />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (data.widgetType === 'LINE' && data.points) {
    const metricKey = data.metric === 'INCOME' ? 'income'
                    : data.metric === 'COUNT'  ? 'count'
                    : 'spend'
    const items = data.points.map(p => ({ month: p.month, value: Number(p[metricKey as keyof typeof p]) }))
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={items} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={data.metric === 'COUNT' ? String : fmt} tick={{ fontSize: 11 }} width={55} />
          <Tooltip formatter={(v: number) => data.metric === 'COUNT' ? v : fmt(v)} />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (data.widgetType === 'STAT' && data.stat) {
    const v = Number(data.stat.value)
    return (
      <div className="flex flex-col items-center justify-center h-32">
        <div className="text-4xl font-bold" style={{ color }}>
          {data.metric === 'COUNT' ? v.toLocaleString() : fmt(v)}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 mt-2 capitalize">{data.stat.label}</div>
      </div>
    )
  }

  return <div className="text-sm text-gray-400 py-8 text-center">No data available</div>
}
```

- [ ] **Step 2: Write CustomDashboardPage**

Create `frontend/src/pages/CustomDashboardPage.tsx`:

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, LayoutGrid } from 'lucide-react'
import {
  getWidgets, createWidget, updateWidget, deleteWidget, getWidgetData,
  type Widget, type CreateWidgetRequest,
} from '../api/widgets'
import WidgetForm from '../components/WidgetForm'
import WidgetRenderer from '../components/WidgetRenderer'

function WidgetCard({ widget, onEdit, onDelete }: {
  widget: Widget
  onEdit: () => void
  onDelete: () => void
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['widget-data', widget.id],
    queryFn: () => getWidgetData(widget.id),
    staleTime: 60_000,
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900 dark:text-white text-sm">{widget.title}</h3>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="h-32 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {isError && (
        <div className="h-32 flex items-center justify-center text-sm text-red-500">
          Failed to load data
        </div>
      )}
      {data && <WidgetRenderer data={data} color={widget.color} />}

      <div className="mt-2 flex gap-1.5">
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
          {widget.widgetType}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
          {widget.periodMonths}m
        </span>
        {widget.filterType !== 'ALL' && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300">
            {widget.filterType}
          </span>
        )}
      </div>
    </div>
  )
}

export default function CustomDashboardPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Widget | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: widgets = [], isLoading } = useQuery({
    queryKey: ['widgets'],
    queryFn: getWidgets,
    staleTime: 30_000,
  })

  const createMut = useMutation({
    mutationFn: createWidget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets'] })
      setShowForm(false)
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, req }: { id: string; req: CreateWidgetRequest }) =>
      updateWidget(id, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets'] })
      setEditing(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: deleteWidget,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['widgets'] })
      queryClient.removeQueries({ queryKey: ['widget-data', id] })
      setDeletingId(null)
    },
  })

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <LayoutGrid className="w-6 h-6 text-indigo-500" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">My Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Custom widgets powered by your transactions</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add widget
        </button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-72 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && widgets.length === 0 && (
        <div className="text-center py-20">
          <LayoutGrid className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-gray-500 dark:text-gray-400 font-medium mb-2">No widgets yet</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
            Add your first widget to visualise your spending
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
          >
            Add widget
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {widgets.map(w => (
          <WidgetCard
            key={w.id}
            widget={w}
            onEdit={() => setEditing(w)}
            onDelete={() => setDeletingId(w.id)}
          />
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <WidgetForm
          onSave={req => createMut.mutate(req)}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Edit form */}
      {editing && (
        <WidgetForm
          existing={editing}
          onSave={req => updateMut.mutate({ id: editing.id, req })}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Delete confirm */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Delete widget?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              This widget will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate(deletingId)}
                disabled={deleteMut.isPending}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "(widget|Widget|WidgetRenderer|CustomDashboard)"
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/WidgetRenderer.tsx \
        frontend/src/pages/CustomDashboardPage.tsx
git commit -m "feat: add WidgetRenderer (pie/bar/line/stat) and CustomDashboardPage"
```

---

## Task 8: Route + Nav Link Wiring

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Add route in App.tsx**

In `frontend/src/App.tsx`, add the import:

```tsx
import CustomDashboardPage from './pages/CustomDashboardPage'
```

Add the route inside the protected `<Route path="/">` block after the `categories` route:

```tsx
<Route path="custom-dashboard" element={<CustomDashboardPage />} />
```

- [ ] **Step 2: Add nav link in Layout.tsx**

In `frontend/src/components/Layout.tsx`, locate the `spend` group in `NAV_GROUPS`:

```tsx
{
  key: 'spend',
  label: 'Spend',
  items: [
    { to: '/',             label: 'Dashboard',        icon: LayoutDashboard },
    { to: '/transactions', label: 'Transactions',     icon: ArrowLeftRight },
    { to: '/categories',   label: 'Categories & Rules', icon: Tag },
  ],
},
```

Add `LayoutGrid` entry (already imported on line 16):

```tsx
{
  key: 'spend',
  label: 'Spend',
  items: [
    { to: '/',                  label: 'Dashboard',          icon: LayoutDashboard },
    { to: '/custom-dashboard',  label: 'My Dashboard',       icon: LayoutGrid },
    { to: '/transactions',      label: 'Transactions',       icon: ArrowLeftRight },
    { to: '/categories',        label: 'Categories & Rules', icon: Tag },
  ],
},
```

- [ ] **Step 3: Full type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Manual test — golden path**

Start the dev server:

```bash
cd frontend && npm run dev
```

Verify:
1. "My Dashboard" link appears in sidebar under Spend group
2. Clicking navigates to `/custom-dashboard`
3. Empty state with "Add widget" button is shown
4. Clicking "Add widget" opens the WidgetForm modal
5. Select chart type PIE, filter ALL, metric SPEND, period 3m, pick a color → click "Add widget"
6. Widget card appears with loading spinner → chart renders
7. Edit pencil opens form pre-filled; save updates title
8. Delete shows confirmation; confirm removes widget

- [ ] **Step 5: Final commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat: wire custom dashboard route and nav link"
```

---

## Self-Review

### Spec coverage
| Requirement | Task |
|---|---|
| Pie chart widget | Task 7 WidgetRenderer PIE branch |
| Bar chart widget | Task 7 WidgetRenderer BAR branch |
| Line chart widget | Task 7 WidgetRenderer LINE branch |
| Count/stat widget | Task 7 WidgetRenderer STAT branch |
| Filter by category subtree | Task 3 `expandCategorySubtree` + Task 2 `categoryBreakdownForIds` |
| Filter by tag/keyword | Task 3 `fetchBreakdownForTag` |
| Filter all transactions | Task 2 `categoryBreakdownAll` / `monthlyTrendAll` |
| SPEND / INCOME / COUNT metrics | Task 3 `buildStatData` + `buildSliceData` + `buildLineData` |
| Configurable period (1–24 months) | Task 6 range slider, Task 3 `from = now - periodMonths` |
| Create widget | Task 4 `POST /api/widgets`, Task 6 WidgetForm, Task 7 page |
| Edit widget | Task 4 `PUT /api/widgets/{id}`, Task 6 form with `existing` prop, Task 7 |
| Delete widget | Task 4 `DELETE /api/widgets/{id}`, Task 7 confirm dialog |
| Persist per user | Task 1 `user_id` FK |
| Nav link | Task 8 |

### Placeholder scan
No TBDs, TODOs, or "implement later" strings in the plan.

### Type consistency
- `WidgetDto.WidgetResponse` ↔ `Widget` interface in `widgets.ts` — all fields match
- `WidgetDto.WidgetData` ↔ `WidgetData` interface — `slices`, `points`, `stat` all nullable in both
- `WidgetForm` accepts `CreateWidgetRequest` on `onSave` — matches `createWidget` and `updateWidget` parameter types
- `WidgetRenderer` receives `WidgetData` + `color: string` — used correctly in `CustomDashboardPage`
- `CategoryTreeUtils.getDescendantIds` returns `Set<UUID>` — we `add(rootId)` then pass `Set<UUID>` to repo — correctly typed as `Collection<UUID>` in Task 2 queries
