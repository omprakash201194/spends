#!/usr/bin/env bash
# =============================================================================
# setup-cluster.sh
# Run this ONCE on the homelab server to prepare the k8s cluster for SpendStack.
#
# What it does:
#   1. Checks kubectl and cluster connectivity
#   2. Creates the spends-secret (JWT signing key)
#   3. Verifies postgres-secret already exists
#   4. Confirms the homelab namespace exists
#   5. Applies all k8s manifests from the repo
#
# Usage:
#   bash scripts/homelab/setup-cluster.sh
#
# Run from the root of the spends repo on the homelab server.
# =============================================================================

set -euo pipefail

NAMESPACE="homelab"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Colours
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; GRAY='\033[0;37m'; NC='\033[0m'

step()  { echo -e "\n${CYAN}  ▶ $*${NC}"; }
ok()    { echo -e "${GREEN}    ✓ $*${NC}"; }
warn()  { echo -e "${YELLOW}    ! $*${NC}"; }
info()  { echo -e "${GRAY}      $*${NC}"; }
fail()  { echo -e "${RED}    ✗ $*${NC}"; exit 1; }

echo ""
echo -e "${CYAN}  ╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}  ║   SpendStack — Cluster Setup             ║${NC}"
echo -e "${CYAN}  ╚══════════════════════════════════════════╝${NC}"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — kubectl
# ─────────────────────────────────────────────────────────────────────────────
step "Checking kubectl..."
command -v kubectl &>/dev/null || fail "kubectl not found. On k3s: sudo ln -s /usr/local/bin/kubectl /usr/bin/kubectl"

kubectl get nodes --no-headers &>/dev/null || fail "Cannot reach cluster. Check KUBECONFIG."
kubectl get nodes --no-headers | while read -r line; do info "$line"; done
ok "Cluster reachable"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Namespace
# ─────────────────────────────────────────────────────────────────────────────
step "Verifying namespace '$NAMESPACE'..."
if kubectl get namespace "$NAMESPACE" &>/dev/null; then
    ok "Namespace '$NAMESPACE' exists"
else
    fail "Namespace '$NAMESPACE' not found. Is this the right cluster?"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Verify postgres-secret exists
# ─────────────────────────────────────────────────────────────────────────────
step "Checking postgres-secret..."
if kubectl get secret postgres-secret -n "$NAMESPACE" &>/dev/null; then
    ok "postgres-secret found"
else
    fail "postgres-secret not found in namespace '$NAMESPACE'.\nSpendStack needs the existing PostgreSQL secret to connect to the database."
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Create spends-secret (JWT key)
# ─────────────────────────────────────────────────────────────────────────────
step "Creating spends-secret (JWT signing key)..."
if kubectl get secret spends-secret -n "$NAMESPACE" &>/dev/null; then
    warn "spends-secret already exists — skipping. Delete and re-run if you need to rotate the key."
    info "To rotate: kubectl delete secret spends-secret -n $NAMESPACE && bash $0"
else
    JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    kubectl create secret generic spends-secret \
        --from-literal=jwt-secret="$JWT_SECRET" \
        -n "$NAMESPACE"
    ok "spends-secret created with a fresh 512-bit JWT key"
    warn "This secret is NOT backed up automatically. Run the following to export it:"
    info "kubectl get secret spends-secret -n $NAMESPACE -o yaml > spends-secret-backup.yaml"
    info "Store that file somewhere safe (NOT in the git repo)."
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — Apply k8s manifests
# ─────────────────────────────────────────────────────────────────────────────
step "Applying Kubernetes manifests from $REPO_ROOT/k8s/..."
if [[ ! -d "$REPO_ROOT/k8s" ]]; then
    fail "k8s/ directory not found at $REPO_ROOT. Run this script from the repo root."
fi

kubectl apply -f "$REPO_ROOT/k8s/" -n "$NAMESPACE"
ok "Manifests applied"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6 — Show status
# ─────────────────────────────────────────────────────────────────────────────
step "Current pod status..."
info "Pods may be in Pending/ImagePullBackOff until images are pushed — that is expected."
kubectl get pods -n "$NAMESPACE" -l "app in (spends-backend,spends-frontend)" 2>/dev/null || true

echo ""
echo -e "${GREEN}  ╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}  ║  Cluster setup complete.                                 ║${NC}"
echo -e "${GREEN}  ║                                                          ║${NC}"
echo -e "${GREEN}  ║  Next steps:                                             ║${NC}"
echo -e "${GREEN}  ║  1. Run setup-runner.sh to register the CI runner        ║${NC}"
echo -e "${GREEN}  ║  2. Push images from your Windows machine:               ║${NC}"
echo -e "${GREEN}  ║       .\scripts\windows\first-deploy.ps1                ║${NC}"
echo -e "${GREEN}  ║     OR push to main and let GitHub Actions deploy        ║${NC}"
echo -e "${GREEN}  ╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
