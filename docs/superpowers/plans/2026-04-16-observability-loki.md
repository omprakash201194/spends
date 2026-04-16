# Phase 21 — Observability (Loki + Structured Logging) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every app on the homelab k3s cluster a consolidated error log view in the existing Grafana instance by deploying Loki + Promtail and emitting structured JSON logs from SpendStack's Spring Boot backend.

**Architecture:** Loki runs as a single-binary deployment in a new `monitoring` namespace on k3s, persisting logs to a PVC. Promtail runs as a DaemonSet that scrapes all pod stdout/stderr across every namespace and ships to Loki — making this cluster-wide, not app-specific. SpendStack's backend adds `logstash-logback-encoder` and a `logback-spring.xml` that emits human-readable logs in `local` profile and structured JSON in `k8s` profile, with a `RequestCorrelationFilter` that injects `requestId`, `method`, and `path` into every log line via MDC. Grafana gets Loki added as a data source.

**Tech Stack:** k3s · Loki 3.0.0 · Promtail 3.0.0 · `logstash-logback-encoder` 8.0 · Spring Boot 3.3.4 logback · Kubernetes RBAC

---

## File Map

| Status | Path | Role |
|---|---|---|
| Create | `monitoring/namespace.yaml` | `monitoring` namespace |
| Create | `monitoring/loki.yaml` | Loki ConfigMap (config) + PVC + Deployment + Service |
| Create | `monitoring/promtail.yaml` | Promtail ClusterRole + ClusterRoleBinding + ServiceAccount + ConfigMap + DaemonSet |
| Create | `monitoring/grafana-datasource.yaml` | Grafana provisioning ConfigMap for Loki data source |
| Modify | `spends/backend/pom.xml` | Add `logstash-logback-encoder` 8.0 dependency |
| Create | `spends/backend/src/main/resources/logback-spring.xml` | Human-readable (local) + structured JSON (k8s) logging config |
| Create | `spends/backend/src/main/java/com/omprakashgautam/homelab/spends/filter/RequestCorrelationFilter.java` | MDC filter: injects `requestId`, `method`, `path` on every request |

All `monitoring/` files live at `f:/Development/home-lab/monitoring/` (sibling of the `spends/` directory — cluster-wide, not app-specific).

---

## Task 1: Loki deployment

**Files:**
- Create: `f:/Development/home-lab/monitoring/namespace.yaml`
- Create: `f:/Development/home-lab/monitoring/loki.yaml`

- [ ] **Step 1: Create namespace.yaml**

Create `f:/Development/home-lab/monitoring/namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: monitoring
```

- [ ] **Step 2: Create loki.yaml**

Create `f:/Development/home-lab/monitoring/loki.yaml`:

```yaml
# ── Loki config ───────────────────────────────────────────────────────────────
apiVersion: v1
kind: ConfigMap
metadata:
  name: loki-config
  namespace: monitoring
data:
  loki.yaml: |
    auth_enabled: false

    server:
      http_listen_port: 3100
      grpc_listen_port: 9096

    common:
      path_prefix: /loki
      storage:
        filesystem:
          chunks_directory: /loki/chunks
          rules_directory: /loki/rules
      replication_factor: 1
      ring:
        kvstore:
          store: inmemory

    schema_config:
      configs:
        - from: 2020-10-24
          store: tsdb
          object_store: filesystem
          schema: v13
          index:
            prefix: index_
            period: 24h

    limits_config:
      reject_old_samples: true
      reject_old_samples_max_age: 168h
      allow_structured_metadata: false

---
# ── Loki storage ──────────────────────────────────────────────────────────────
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: loki-pvc
  namespace: monitoring
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi

---
# ── Loki deployment ───────────────────────────────────────────────────────────
apiVersion: apps/v1
kind: Deployment
metadata:
  name: loki
  namespace: monitoring
  labels:
    app: loki
spec:
  replicas: 1
  selector:
    matchLabels:
      app: loki
  template:
    metadata:
      labels:
        app: loki
    spec:
      securityContext:
        fsGroup: 10001
        runAsUser: 10001
        runAsGroup: 10001
      containers:
        - name: loki
          image: grafana/loki:3.0.0
          args:
            - -config.file=/etc/loki/loki.yaml
          ports:
            - containerPort: 3100
              name: http
            - containerPort: 9096
              name: grpc
          volumeMounts:
            - name: config
              mountPath: /etc/loki
            - name: storage
              mountPath: /loki
          readinessProbe:
            httpGet:
              path: /ready
              port: 3100
            initialDelaySeconds: 30
            periodSeconds: 10
          resources:
            requests:
              memory: "128Mi"
              cpu: "50m"
            limits:
              memory: "512Mi"
              cpu: "200m"
      volumes:
        - name: config
          configMap:
            name: loki-config
        - name: storage
          persistentVolumeClaim:
            claimName: loki-pvc

---
# ── Loki service ──────────────────────────────────────────────────────────────
apiVersion: v1
kind: Service
metadata:
  name: loki
  namespace: monitoring
spec:
  selector:
    app: loki
  ports:
    - port: 3100
      targetPort: 3100
      name: http
  type: ClusterIP
```

- [ ] **Step 3: Apply namespace and Loki**

```bash
kubectl apply -f f:/Development/home-lab/monitoring/namespace.yaml
kubectl apply -f f:/Development/home-lab/monitoring/loki.yaml
```

Expected output:
```
namespace/monitoring created
configmap/loki-config created
persistentvolumeclaim/loki-pvc created
deployment.apps/loki created
service/loki created
```

- [ ] **Step 4: Wait for Loki to be ready**

```bash
kubectl rollout status deployment/loki -n monitoring --timeout=120s
```

Expected: `deployment "loki" successfully rolled out`

- [ ] **Step 5: Verify Loki is healthy**

```bash
kubectl port-forward svc/loki -n monitoring 3100:3100 &
sleep 3
curl -s http://localhost:3100/ready
kill %1
```

Expected: `ready`

- [ ] **Step 6: Commit**

```bash
cd f:/Development/home-lab && git add monitoring/namespace.yaml monitoring/loki.yaml && git commit -m "feat: deploy Loki 3.0 to monitoring namespace on k3s"
```

Note: if `f:/Development/home-lab` is not a git repo (the spends subdirectory is), commit from the spends repo path instead and include the monitoring directory:
```bash
cd f:/Development/home-lab/spends && git add ../monitoring/namespace.yaml ../monitoring/loki.yaml && git commit -m "feat: deploy Loki 3.0 to monitoring namespace on k3s"
```

---

## Task 2: Promtail DaemonSet

**Files:**
- Create: `f:/Development/home-lab/monitoring/promtail.yaml`

- [ ] **Step 1: Create promtail.yaml**

Create `f:/Development/home-lab/monitoring/promtail.yaml`:

```yaml
# ── RBAC: Promtail needs cluster-wide pod discovery ───────────────────────────
apiVersion: v1
kind: ServiceAccount
metadata:
  name: promtail
  namespace: monitoring

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: promtail
rules:
  - apiGroups: [""]
    resources: ["nodes", "nodes/proxy", "services", "endpoints", "pods"]
    verbs: ["get", "watch", "list"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: promtail
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: promtail
subjects:
  - kind: ServiceAccount
    name: promtail
    namespace: monitoring

---
# ── Promtail config ───────────────────────────────────────────────────────────
apiVersion: v1
kind: ConfigMap
metadata:
  name: promtail-config
  namespace: monitoring
data:
  promtail.yaml: |
    server:
      http_listen_port: 9080
      grpc_listen_port: 0

    positions:
      filename: /tmp/positions.yaml

    clients:
      - url: http://loki.monitoring.svc.cluster.local:3100/loki/api/v1/push

    scrape_configs:
      - job_name: kubernetes-pods
        kubernetes_sd_configs:
          - role: pod
        pipeline_stages:
          # Parse JSON logs emitted by Spring Boot (k8s profile)
          # Falls back silently if logs are not JSON
          - json:
              expressions:
                log_level: level
                log_message: message
          - labels:
              log_level:
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_label_app]
            target_label: app
          - source_labels: [__meta_kubernetes_namespace]
            target_label: namespace
          - source_labels: [__meta_kubernetes_pod_name]
            target_label: pod
          - source_labels: [__meta_kubernetes_pod_container_name]
            target_label: container
          # Build the log file path from pod UID and container name
          - source_labels: [__meta_kubernetes_pod_uid, __meta_kubernetes_pod_container_name]
            separator: /
            replacement: /var/log/pods/*$1/*.log
            target_label: __path__
          # Drop pods with no app label (system pods)
          - source_labels: [app]
            regex: .+
            action: keep

---
# ── Promtail DaemonSet ────────────────────────────────────────────────────────
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: promtail
  namespace: monitoring
  labels:
    app: promtail
spec:
  selector:
    matchLabels:
      app: promtail
  template:
    metadata:
      labels:
        app: promtail
    spec:
      serviceAccountName: promtail
      tolerations:
        # Run on control-plane nodes too (k3s single-node setups)
        - key: node-role.kubernetes.io/control-plane
          operator: Exists
          effect: NoSchedule
        - key: node-role.kubernetes.io/master
          operator: Exists
          effect: NoSchedule
      containers:
        - name: promtail
          image: grafana/promtail:3.0.0
          args:
            - -config.file=/etc/promtail/promtail.yaml
          ports:
            - containerPort: 9080
              name: http
          env:
            - name: HOSTNAME
              valueFrom:
                fieldRef:
                  fieldPath: spec.nodeName
          volumeMounts:
            - name: config
              mountPath: /etc/promtail
            - name: varlog
              mountPath: /var/log
              readOnly: true
            - name: varlibdockercontainers
              mountPath: /var/lib/docker/containers
              readOnly: true
          resources:
            requests:
              memory: "64Mi"
              cpu: "50m"
            limits:
              memory: "128Mi"
              cpu: "100m"
      volumes:
        - name: config
          configMap:
            name: promtail-config
        - name: varlog
          hostPath:
            path: /var/log
        - name: varlibdockercontainers
          hostPath:
            path: /var/lib/docker/containers
```

- [ ] **Step 2: Apply Promtail**

```bash
kubectl apply -f f:/Development/home-lab/monitoring/promtail.yaml
```

Expected output:
```
serviceaccount/promtail created
clusterrole.rbac.authorization.k8s.io/promtail created
clusterrolebinding.rbac.authorization.k8s.io/promtail created
configmap/promtail-config created
daemonset.apps/promtail created
```

- [ ] **Step 3: Verify Promtail is running**

```bash
kubectl get pods -n monitoring
```

Expected: Both `loki-*` and `promtail-*` pods in `Running` state.

Check Promtail is shipping logs (look for "Successfully sent batch" or "stream" messages):
```bash
kubectl logs -n monitoring -l app=promtail --tail=20
```

Expected: Lines containing `"level":"info"` and references to pod log paths — no ERROR lines.

- [ ] **Step 4: Verify logs reach Loki**

```bash
kubectl port-forward svc/loki -n monitoring 3100:3100 &
sleep 3
# Query for any labels Loki has received
curl -s "http://localhost:3100/loki/api/v1/labels" | python3 -m json.tool 2>/dev/null || curl -s "http://localhost:3100/loki/api/v1/labels"
kill %1
```

Expected: JSON response with `"data": ["app", "container", "namespace", "pod", ...]` — confirms Promtail has pushed logs and Loki has indexed them.

- [ ] **Step 5: Commit**

```bash
cd f:/Development/home-lab/spends && git add ../monitoring/promtail.yaml && git commit -m "feat: Promtail DaemonSet — cluster-wide log scraping to Loki"
```

---

## Task 3: Grafana Loki data source

**Files:**
- Create: `f:/Development/home-lab/monitoring/grafana-datasource.yaml`

**Context:** This task adds Loki as a Grafana data source. There are two approaches depending on how Grafana is deployed:
- **Provisioning (automated):** Mount a ConfigMap into Grafana's provisioning directory. Requires knowing Grafana's namespace and deployment name.
- **Manual UI (always works):** Add via Grafana's web UI at Settings → Data Sources.

This task provides the provisioning ConfigMap AND the manual steps as fallback.

- [ ] **Step 1: Find your Grafana namespace**

```bash
kubectl get pods -A | grep grafana
```

Note the namespace (e.g., `monitoring`, `grafana`, `homelab`). You'll use it in the next steps.

- [ ] **Step 2: Create grafana-datasource.yaml**

Create `f:/Development/home-lab/monitoring/grafana-datasource.yaml`.

Replace `YOUR_GRAFANA_NAMESPACE` with the namespace found in Step 1:

```yaml
# Grafana provisioning ConfigMap — mounts into Grafana's /etc/grafana/provisioning/datasources/
# Apply to the namespace where your Grafana pod lives.
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-loki-datasource
  namespace: YOUR_GRAFANA_NAMESPACE
  labels:
    grafana_datasource: "1"
data:
  loki.yaml: |
    apiVersion: 1
    datasources:
      - name: Loki
        type: loki
        access: proxy
        url: http://loki.monitoring.svc.cluster.local:3100
        isDefault: false
        jsonData:
          maxLines: 1000
          timeout: 60
```

- [ ] **Step 3: Apply the ConfigMap**

```bash
kubectl apply -f f:/Development/home-lab/monitoring/grafana-datasource.yaml
```

- [ ] **Step 4: Mount the ConfigMap into Grafana OR add the data source manually**

**Option A — Provisioning mount (if Grafana is deployed via a k8s Deployment you control):**

Find Grafana's deployment name:
```bash
kubectl get deployment -n YOUR_GRAFANA_NAMESPACE | grep grafana
```

Patch the Grafana deployment to mount the ConfigMap:
```bash
kubectl patch deployment YOUR_GRAFANA_DEPLOYMENT_NAME -n YOUR_GRAFANA_NAMESPACE --type=json -p='[
  {"op":"add","path":"/spec/template/spec/volumes/-","value":{"name":"loki-datasource","configMap":{"name":"grafana-loki-datasource"}}},
  {"op":"add","path":"/spec/template/spec/containers/0/volumeMounts/-","value":{"name":"loki-datasource","mountPath":"/etc/grafana/provisioning/datasources/loki.yaml","subPath":"loki.yaml"}}
]'
```

Then restart Grafana to pick up the new mount:
```bash
kubectl rollout restart deployment/YOUR_GRAFANA_DEPLOYMENT_NAME -n YOUR_GRAFANA_NAMESPACE
kubectl rollout status deployment/YOUR_GRAFANA_DEPLOYMENT_NAME -n YOUR_GRAFANA_NAMESPACE --timeout=60s
```

**Option B — Manual UI (always works, no k8s changes needed):**

1. Open Grafana in browser
2. Go to **Connections → Data Sources → Add new data source**
3. Select **Loki**
4. Set URL: `http://loki.monitoring.svc.cluster.local:3100`
5. Click **Save & Test** — should show "Data source connected and labels found"

- [ ] **Step 5: Verify the data source works**

In Grafana, go to **Explore** and select the **Loki** data source.

Run this LogQL query to see SpendStack backend logs:
```
{namespace="homelab", app="spends-backend"}
```

Expected: Log lines from the spends-backend pod appear in the timeline.

Run this query to see only errors (works even before structured logging is set up):
```
{namespace="homelab", app="spends-backend"} |= "ERROR"
```

- [ ] **Step 6: Commit**

```bash
cd f:/Development/home-lab/spends && git add ../monitoring/grafana-datasource.yaml && git commit -m "feat: Grafana Loki data source provisioning ConfigMap"
```

---

## Task 4: Spring Boot structured JSON logging

**Files:**
- Modify: `spends/backend/pom.xml`
- Create: `spends/backend/src/main/resources/logback-spring.xml`
- Create: `spends/backend/src/main/java/com/omprakashgautam/homelab/spends/filter/RequestCorrelationFilter.java`

- [ ] **Step 1: Add logstash-logback-encoder to pom.xml**

Open `spends/backend/pom.xml`. Find the `<!-- Test -->` comment section. Add before it:

```xml
        <!-- Structured JSON logging for Loki -->
        <dependency>
            <groupId>net.logstash.logback</groupId>
            <artifactId>logstash-logback-encoder</artifactId>
            <version>8.0</version>
        </dependency>
```

- [ ] **Step 2: Create logback-spring.xml**

Create `spends/backend/src/main/resources/logback-spring.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>

  <!--
    local profile: human-readable coloured console.
    k8s   profile: structured JSON consumed by Promtail → Loki.
  -->

  <springProfile name="local">
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
      <encoder>
        <pattern>%d{HH:mm:ss.SSS} %highlight(%-5level) [%cyan(%X{requestId:-      })] %cyan(%logger{36}) - %msg%n</pattern>
      </encoder>
    </appender>
    <root level="INFO">
      <appender-ref ref="CONSOLE"/>
    </root>
    <logger name="com.omprakashgautam" level="DEBUG"/>
  </springProfile>

  <springProfile name="k8s">
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
      <encoder class="net.logstash.logback.encoder.LogstashEncoder">
        <!-- MDC fields injected by RequestCorrelationFilter -->
        <includeMdcKeyName>requestId</includeMdcKeyName>
        <includeMdcKeyName>method</includeMdcKeyName>
        <includeMdcKeyName>path</includeMdcKeyName>
        <!-- Rename default fields to match Loki/Grafana conventions -->
        <fieldNames>
          <timestamp>timestamp</timestamp>
          <message>message</message>
          <logger>logger</logger>
          <thread>thread</thread>
          <level>level</level>
          <levelValue>[ignore]</levelValue>
        </fieldNames>
      </encoder>
    </appender>
    <root level="INFO">
      <appender-ref ref="CONSOLE"/>
    </root>
  </springProfile>

</configuration>
```

- [ ] **Step 3: Create RequestCorrelationFilter**

Create `spends/backend/src/main/java/com/omprakashgautam/homelab/spends/filter/RequestCorrelationFilter.java`:

```java
package com.omprakashgautam.homelab.spends.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Injects a short request ID, HTTP method, and path into the SLF4J MDC for
 * every incoming request. These fields appear in every log line emitted during
 * the request, making it easy to trace a single API call end-to-end in Loki.
 *
 * Also adds an {@code X-Request-Id} response header so callers can correlate
 * client-side errors with backend log entries.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestCorrelationFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String requestId = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        MDC.put("requestId", requestId);
        MDC.put("method",    request.getMethod());
        MDC.put("path",      request.getRequestURI());
        response.setHeader("X-Request-Id", requestId);

        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.clear();
        }
    }
}
```

- [ ] **Step 4: Compile check**

```bash
cd f:/Development/home-lab/spends/backend && mvn compile -q 2>&1 | tail -5
```

Expected: no output (success).

- [ ] **Step 5: Run full test suite**

```bash
cd f:/Development/home-lab/spends/backend && mvn test -q 2>&1 | grep -E "Tests run:|BUILD" | tail -5
```

Expected: `Tests run: 39, Failures: 0, Errors: 0, Skipped: 0` and `BUILD SUCCESS`.

- [ ] **Step 6: Verify local profile still logs human-readable**

Start the backend locally with the `local` profile and confirm logs are still readable (not JSON):

```bash
cd f:/Development/home-lab/spends/backend && SPRING_PROFILES_ACTIVE=local mvn spring-boot:run -Dspring-boot.run.profiles=local 2>&1 | head -20
```

Expected: Log lines with timestamps, coloured level indicators, and `[requestId]` fields — NOT raw JSON. Stop with Ctrl+C after confirming.

- [ ] **Step 7: Verify k8s profile emits JSON**

```bash
cd f:/Development/home-lab/spends/backend && SPRING_PROFILES_ACTIVE=k8s APP_JWT_SECRET=dGVzdC1zZWNyZXQtZm9yLXZlcmlmeS1vbmx5LXRlc3Qtc2VjcmV0LWZvcg== DB_PASSWORD=test mvn spring-boot:run -Dspring-boot.run.profiles=k8s 2>&1 | head -5
```

Expected: Each line is valid JSON, e.g.:
```json
{"timestamp":"2026-04-16T...","level":"INFO","logger":"...","message":"Starting..."}
```

Stop with Ctrl+C. If DB connection fails that is expected (no DB in this test) — we only care that log lines are JSON-formatted.

- [ ] **Step 8: Commit**

```bash
cd f:/Development/home-lab/spends && git add backend/pom.xml backend/src/main/resources/logback-spring.xml backend/src/main/java/com/omprakashgautam/homelab/spends/filter/RequestCorrelationFilter.java && git commit -m "feat: structured JSON logging (logstash-logback-encoder) + RequestCorrelationFilter MDC"
```

- [ ] **Step 9: Push to origin**

```bash
cd f:/Development/home-lab/spends && git push origin main
```

---

## Post-deployment: Grafana dashboard queries

Once SpendStack is redeployed (CI will trigger on push), use these LogQL queries in Grafana Explore to build dashboard panels:

**All backend logs (live tail):**
```logql
{namespace="homelab", app="spends-backend"}
```

**Error logs only:**
```logql
{namespace="homelab", app="spends-backend"} | json | level="ERROR"
```

**Error rate over time (for a Graph panel):**
```logql
sum(count_over_time({namespace="homelab", app="spends-backend"} | json | level="ERROR" [1m]))
```

**Slow/warn logs:**
```logql
{namespace="homelab", app="spends-backend"} | json | level="WARN"
```

**Trace a specific request by ID:**
```logql
{namespace="homelab", app="spends-backend"} | json | requestId="a1b2c3d4"
```

**All apps — errors across the cluster:**
```logql
{namespace=~"homelab|monitoring"} | json | level="ERROR"
```

Save these as a "SpendStack" dashboard in Grafana for persistent access.
