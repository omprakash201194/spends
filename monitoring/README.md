# Monitoring Stack

Loki + Promtail log aggregation for the homelab k3s cluster.

## Deploy

```bash
# 1. Create namespace and deploy Loki
kubectl apply -f monitoring/namespace.yaml
kubectl apply -f monitoring/loki.yaml

# 2. Deploy Promtail DaemonSet (cluster-wide log scraping)
kubectl apply -f monitoring/promtail.yaml

# 3. Add Grafana data source
#    Find your Grafana namespace first:
kubectl get pods -A | grep grafana
#    Then edit grafana-datasource.yaml, replace YOUR_GRAFANA_NAMESPACE, and apply:
kubectl apply -f monitoring/grafana-datasource.yaml
```

## Grafana LogQL queries

Once the Loki data source is added in Grafana (Connections → Data Sources → Add → Loki,
URL: `http://loki.monitoring.svc.cluster.local:3100`), use these queries:

**All SpendStack backend logs:**
```
{namespace="homelab", app="spends-backend"}
```

**Errors only:**
```
{namespace="homelab", app="spends-backend"} | json | log_level="ERROR"
```

**Error rate over time (Graph panel):**
```
sum(count_over_time({namespace="homelab", app="spends-backend"} | json | log_level="ERROR" [1m]))
```

**Trace a specific request by ID:**
```
{namespace="homelab", app="spends-backend"} | json | requestId="a1b2c3d4"
```

**All apps — errors across the cluster:**
```
{namespace=~"homelab|monitoring"} | json | log_level="ERROR"
```
