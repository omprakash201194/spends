#!/usr/bin/env bash
# =============================================================================
# deploy-monitoring.sh
# Deploys Loki + Promtail to the k3s cluster and wires Grafana as a datasource.
#
# What it does:
#   1. Creates the 'monitoring' namespace
#   2. Deploys Loki 3.0 (single-binary, filesystem storage, PVC 5Gi)
#   3. Waits for Loki to be ready and verifies /ready
#   4. Deploys Promtail DaemonSet (cluster-wide log scraping → Loki)
#   5. Verifies logs are flowing into Loki
#   6. Detects Grafana and adds Loki as a datasource (provisioning or manual)
#
# Usage:
#   bash scripts/homelab/deploy-monitoring.sh
#
# Run from the root of the spends repo on the homelab server.
# =============================================================================

set -euo pipefail

MONITORING_NS="monitoring"
LOKI_SVC="http://loki.monitoring.svc.cluster.local:3100"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MONITORING_DIR="$REPO_ROOT/monitoring"

# Colours
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; GRAY='\033[0;37m'; NC='\033[0m'

step() { echo -e "\n${CYAN}  >> $*${NC}"; }
ok()   { echo -e "${GREEN}    + $*${NC}"; }
warn() { echo -e "${YELLOW}    ! $*${NC}"; }
info() { echo -e "${GRAY}      $*${NC}"; }
fail() { echo -e "${RED}    x $*${NC}"; exit 1; }

echo ""
echo -e "${CYAN}  +------------------------------------------+${NC}"
echo -e "${CYAN}  |   Homelab Monitoring — Loki + Promtail   |${NC}"
echo -e "${CYAN}  +------------------------------------------+${NC}"

# =============================================================================
# STEP 0 — Preflight
# =============================================================================
step "Preflight checks..."

command -v kubectl &>/dev/null || fail "kubectl not found. On k3s: sudo ln -s /usr/local/bin/kubectl /usr/bin/kubectl"
kubectl get nodes --no-headers &>/dev/null || fail "Cannot reach cluster. Check KUBECONFIG."
kubectl get nodes --no-headers | while read -r line; do info "$line"; done
ok "Cluster reachable"

[[ -d "$MONITORING_DIR" ]] || fail "monitoring/ directory not found at $MONITORING_DIR. Run from the repo root."
ok "Monitoring manifests found at $MONITORING_DIR"

# =============================================================================
# STEP 1 — Namespace
# =============================================================================
step "Creating 'monitoring' namespace..."
kubectl apply -f "$MONITORING_DIR/namespace.yaml"
ok "Namespace ready"

# =============================================================================
# STEP 2 — Loki
# =============================================================================
step "Deploying Loki 3.0..."
kubectl apply -f "$MONITORING_DIR/loki.yaml"
ok "Loki manifests applied"

step "Waiting for Loki rollout (up to 3 minutes)..."
if kubectl rollout status deployment/loki -n "$MONITORING_NS" --timeout=180s; then
    ok "Loki deployment rolled out"
else
    fail "Loki rollout timed out. Check: kubectl describe pods -n $MONITORING_NS -l app=loki"
fi

step "Verifying Loki /ready endpoint..."
LOKI_POD=$(kubectl get pod -n "$MONITORING_NS" -l app=loki -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [[ -z "$LOKI_POD" ]]; then
    fail "No Loki pod found in namespace '$MONITORING_NS'."
fi

READY_RESP=$(kubectl exec -n "$MONITORING_NS" "$LOKI_POD" -- \
    wget -qO- http://localhost:3100/ready 2>/dev/null || echo "")
if [[ "$READY_RESP" == *"ready"* ]]; then
    ok "Loki is healthy (responded: $READY_RESP)"
else
    warn "Loki /ready returned: '${READY_RESP:-<empty>}'. It may still be initialising."
    info "Check: kubectl logs -n $MONITORING_NS $LOKI_POD --tail=20"
fi

# =============================================================================
# STEP 3 — Promtail
# =============================================================================
step "Deploying Promtail DaemonSet..."
kubectl apply -f "$MONITORING_DIR/promtail.yaml"
ok "Promtail manifests applied"

step "Waiting for Promtail DaemonSet to be ready (up to 2 minutes)..."
# DaemonSets don't have a rollout status in older kubectl; poll desired vs ready
TIMEOUT=120
ELAPSED=0
while true; do
    DESIRED=$(kubectl get ds promtail -n "$MONITORING_NS" -o jsonpath='{.status.desiredNumberScheduled}' 2>/dev/null || echo "0")
    READY=$(kubectl get ds promtail -n "$MONITORING_NS" -o jsonpath='{.status.numberReady}' 2>/dev/null || echo "0")
    if [[ "$DESIRED" -gt 0 && "$DESIRED" == "$READY" ]]; then
        ok "Promtail DaemonSet ready ($READY/$DESIRED)"
        break
    fi
    if [[ $ELAPSED -ge $TIMEOUT ]]; then
        warn "Promtail DaemonSet not fully ready after ${TIMEOUT}s ($READY/$DESIRED ready)."
        info "This is normal on single-node clusters. Check: kubectl get pods -n $MONITORING_NS"
        break
    fi
    info "Waiting for Promtail pods... ($READY/$DESIRED ready, ${ELAPSED}s elapsed)"
    sleep 10
    ELAPSED=$((ELAPSED + 10))
done

step "Checking Promtail logs for errors..."
sleep 5
PROMTAIL_ERRORS=$(kubectl logs -n "$MONITORING_NS" -l app=promtail --tail=30 2>/dev/null \
    | grep -i "error\|failed\|fatal" | grep -v "level=info" || true)
if [[ -n "$PROMTAIL_ERRORS" ]]; then
    warn "Promtail log errors detected:"
    echo "$PROMTAIL_ERRORS" | while read -r line; do info "$line"; done
else
    ok "No errors in Promtail logs"
fi

# =============================================================================
# STEP 4 — Verify logs flowing to Loki
# =============================================================================
step "Verifying logs are reaching Loki (waiting 15s for Promtail to ship first batch)..."
sleep 15

LABELS_RESP=$(kubectl exec -n "$MONITORING_NS" "$LOKI_POD" -- \
    wget -qO- "http://localhost:3100/loki/api/v1/labels" 2>/dev/null || echo "")
if echo "$LABELS_RESP" | grep -q '"data"'; then
    LABEL_COUNT=$(echo "$LABELS_RESP" | grep -o '"[^"]*"' | grep -v '"data"\|"status"\|"success"' | wc -l)
    ok "Loki has received logs — $LABEL_COUNT label(s) indexed"
    info "$LABELS_RESP"
else
    warn "Loki /labels returned no data yet. Promtail may still be initialising."
    info "Re-check in 60s: kubectl exec -n $MONITORING_NS $LOKI_POD -- wget -qO- 'http://localhost:3100/loki/api/v1/labels'"
fi

# =============================================================================
# STEP 5 — Grafana datasource
# =============================================================================
step "Detecting Grafana deployment..."
GRAFANA_NS=$(kubectl get pods -A --no-headers 2>/dev/null \
    | grep grafana | grep -v promtail | head -1 | awk '{print $1}')
GRAFANA_DEPLOY=$(kubectl get deployment -n "${GRAFANA_NS:-__none__}" --no-headers 2>/dev/null \
    | grep grafana | head -1 | awk '{print $1}' || true)

if [[ -z "$GRAFANA_NS" ]]; then
    warn "No Grafana pod found. Add the datasource manually (see instructions below)."
else
    ok "Found Grafana in namespace '$GRAFANA_NS' (deployment: ${GRAFANA_DEPLOY:-unknown})"

    # Patch grafana-datasource.yaml with the real namespace and apply
    DATASOURCE_FILE="$MONITORING_DIR/grafana-datasource.yaml"
    PATCHED_FILE=$(mktemp)
    sed "s/YOUR_GRAFANA_NAMESPACE/$GRAFANA_NS/g" "$DATASOURCE_FILE" > "$PATCHED_FILE"

    step "Applying Loki datasource ConfigMap to namespace '$GRAFANA_NS'..."
    kubectl apply -f "$PATCHED_FILE"
    rm -f "$PATCHED_FILE"
    ok "Datasource ConfigMap applied"

    if [[ -n "$GRAFANA_DEPLOY" ]]; then
        step "Patching Grafana deployment to mount the datasource ConfigMap..."
        # Check if volume already mounted (idempotent)
        ALREADY_MOUNTED=$(kubectl get deployment "$GRAFANA_DEPLOY" -n "$GRAFANA_NS" \
            -o jsonpath='{.spec.template.spec.volumes[*].name}' 2>/dev/null | grep "loki-datasource" || true)
        if [[ -n "$ALREADY_MOUNTED" ]]; then
            ok "Loki datasource volume already mounted — skipping patch"
        else
            kubectl patch deployment "$GRAFANA_DEPLOY" -n "$GRAFANA_NS" --type=json -p='[
              {"op":"add","path":"/spec/template/spec/volumes/-","value":{"name":"loki-datasource","configMap":{"name":"grafana-loki-datasource"}}},
              {"op":"add","path":"/spec/template/spec/containers/0/volumeMounts/-","value":{"name":"loki-datasource","mountPath":"/etc/grafana/provisioning/datasources/loki.yaml","subPath":"loki.yaml"}}
            ]'
            ok "Grafana deployment patched"

            step "Restarting Grafana to pick up the new mount..."
            kubectl rollout restart deployment/"$GRAFANA_DEPLOY" -n "$GRAFANA_NS"
            kubectl rollout status deployment/"$GRAFANA_DEPLOY" -n "$GRAFANA_NS" --timeout=60s
            ok "Grafana restarted"
        fi
    else
        warn "Could not determine Grafana deployment name — skipping volume mount."
        info "If Grafana is deployed via Helm, add the datasource manually (see below)."
    fi
fi

# =============================================================================
# Done
# =============================================================================
echo ""
echo -e "${GREEN}  +----------------------------------------------------------+${NC}"
echo -e "${GREEN}  |  Monitoring stack deployed.                              |${NC}"
echo -e "${GREEN}  +----------------------------------------------------------+${NC}"
echo ""

echo -e "${CYAN}  Pod status:${NC}"
kubectl get pods -n "$MONITORING_NS" -o wide
echo ""

if [[ -z "$GRAFANA_NS" ]]; then
    echo -e "${YELLOW}  Manual datasource setup (Grafana not auto-detected):${NC}"
    echo -e "    1. Open Grafana -> Connections -> Data Sources -> Add"
    echo -e "    2. Select Loki"
    echo -e "    3. URL: $LOKI_SVC"
    echo -e "    4. Save & Test"
    echo ""
fi

echo -e "${CYAN}  LogQL queries to try in Grafana Explore:${NC}"
echo -e "    All SpendStack backend logs:"
echo -e "      {namespace=\"homelab\", app=\"spends-backend\"}"
echo -e ""
echo -e "    Errors only:"
echo -e "      {namespace=\"homelab\", app=\"spends-backend\"} |= \"ERROR\""
echo -e ""
echo -e "    Structured JSON errors:"
echo -e "      {namespace=\"homelab\", app=\"spends-backend\"} | json | level=\"ERROR\""
echo -e ""
echo -e "    Trace a request by ID (from X-Request-Id header):"
echo -e "      {namespace=\"homelab\"} | json | requestId=\"<8-char-id>\""
echo -e ""
echo -e "    All namespaces, errors only:"
echo -e "      {namespace=~\".+\"} |= \"ERROR\""
echo ""
