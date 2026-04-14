#!/usr/bin/env bash
# =============================================================================
# setup-runner.sh
# Run this ONCE on the homelab server to install all CI prerequisites and
# register the GitHub Actions self-hosted runner.
#
# What it does:
#   1. Installs Docker Engine (if missing)
#   2. Configures Docker for the local insecure registry (localhost:30500)
#   3. Installs Java 21 (if missing)
#   4. Installs Maven (if missing)
#   5. Installs Node.js 20 (if missing)
#   6. Downloads and configures the GitHub Actions runner agent
#   7. Installs the runner as a systemd service
#
# Usage:
#   bash scripts/homelab/setup-runner.sh --token <RUNNER_TOKEN>
#
# Get your runner token from:
#   https://github.com/omprakash201194/spends/settings/actions/runners
#   → New self-hosted runner → Linux → copy the token from the config step
#
# The token expires in ~1 hour. If it expires, generate a new one and re-run.
# =============================================================================

set -euo pipefail

REPO_URL="https://github.com/omprakash201194/spends"
RUNNER_DIR="$HOME/actions-runner"
RUNNER_NAME="homelab"
RUNNER_LABELS="self-hosted,Linux,homelab"
REGISTRY="localhost:30500"

# Colours
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; GRAY='\033[0;37m'; NC='\033[0m'

step() { echo -e "\n${CYAN}  ▶ $*${NC}"; }
ok()   { echo -e "${GREEN}    ✓ $*${NC}"; }
warn() { echo -e "${YELLOW}    ! $*${NC}"; }
info() { echo -e "${GRAY}      $*${NC}"; }
fail() { echo -e "${RED}    ✗ $*${NC}"; exit 1; }

# ─────────────────────────────────────────────────────────────────────────────
# Parse arguments
# ─────────────────────────────────────────────────────────────────────────────
RUNNER_TOKEN=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --token|-t) RUNNER_TOKEN="$2"; shift 2 ;;
        *) fail "Unknown argument: $1" ;;
    esac
done

if [[ -z "$RUNNER_TOKEN" ]]; then
    echo ""
    echo -e "${RED}  Error: --token is required.${NC}"
    echo ""
    echo "  Get a runner token from:"
    echo "    https://github.com/omprakash201194/spends/settings/actions/runners"
    echo "    → New self-hosted runner → Linux → copy the token shown in step 2"
    echo ""
    echo "  Usage:  bash setup-runner.sh --token YOUR_TOKEN_HERE"
    echo ""
    exit 1
fi

echo ""
echo -e "${CYAN}  ╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}  ║   SpendStack — Homelab Runner Setup      ║${NC}"
echo -e "${CYAN}  ╚══════════════════════════════════════════╝${NC}"

# Detect distro package manager
if command -v apt-get &>/dev/null; then
    PKG_MGR="apt"
elif command -v dnf &>/dev/null; then
    PKG_MGR="dnf"
else
    fail "Unsupported package manager. Only apt (Debian/Ubuntu) and dnf (RHEL/Fedora) are supported."
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Docker Engine
# ─────────────────────────────────────────────────────────────────────────────
step "Checking Docker Engine..."
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
    ok "Docker already installed and running ($(docker --version))"
else
    warn "Docker not found — installing Docker Engine..."

    if [[ "$PKG_MGR" == "apt" ]]; then
        sudo apt-get update -q
        sudo apt-get install -y -q ca-certificates curl gnupg lsb-release

        sudo install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg |
            sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        sudo chmod a+r /etc/apt/keyrings/docker.gpg

        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
          https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" |
          sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

        sudo apt-get update -q
        sudo apt-get install -y -q docker-ce docker-ce-cli containerd.io
    else
        sudo dnf -y install docker-ce docker-ce-cli containerd.io
    fi

    sudo systemctl enable --now docker
    sudo usermod -aG docker "$USER"
    ok "Docker installed"
    warn "You may need to log out and back in for the docker group to take effect."
    warn "If docker commands fail, run: newgrp docker"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Configure Docker for local insecure registry
# ─────────────────────────────────────────────────────────────────────────────
step "Configuring Docker for insecure registry ($REGISTRY)..."
DAEMON_JSON="/etc/docker/daemon.json"

if [[ -f "$DAEMON_JSON" ]]; then
    if grep -q "$REGISTRY" "$DAEMON_JSON" 2>/dev/null; then
        ok "$REGISTRY already in insecure-registries"
    else
        warn "daemon.json exists but doesn't include $REGISTRY."
        warn "Manually add to $DAEMON_JSON:"
        echo ""
        echo '    { "insecure-registries": ["'"$REGISTRY"'"] }'
        echo ""
        warn "Then: sudo systemctl restart docker"
    fi
else
    echo '{ "insecure-registries": ["'"$REGISTRY"'"] }' |
        sudo tee "$DAEMON_JSON" > /dev/null
    sudo systemctl restart docker
    ok "daemon.json created and Docker restarted"
fi

# Verify
if docker info 2>/dev/null | grep -q "$REGISTRY"; then
    ok "Insecure registry confirmed in Docker daemon"
else
    warn "Could not confirm insecure registry — check $DAEMON_JSON manually"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Java 21
# ─────────────────────────────────────────────────────────────────────────────
step "Checking Java 21..."
JAVA_OK=false
if command -v java &>/dev/null; then
    JAVA_VER=$(java -version 2>&1 | head -1)
    if echo "$JAVA_VER" | grep -q '"21'; then
        ok "Java 21 present ($JAVA_VER)"
        JAVA_OK=true
    else
        warn "Wrong Java version: $JAVA_VER"
    fi
fi

if [[ "$JAVA_OK" == "false" ]]; then
    info "Installing Eclipse Temurin 21..."
    if [[ "$PKG_MGR" == "apt" ]]; then
        sudo apt-get install -y -q wget apt-transport-https

        wget -qO - https://packages.adoptium.net/artifactory/api/gpg/key/public |
            sudo gpg --dearmor -o /etc/apt/keyrings/adoptium.gpg
        echo "deb [signed-by=/etc/apt/keyrings/adoptium.gpg] \
            https://packages.adoptium.net/artifactory/deb \
            $(lsb_release -cs) main" |
            sudo tee /etc/apt/sources.list.d/adoptium.list > /dev/null

        sudo apt-get update -q
        sudo apt-get install -y -q temurin-21-jdk
    else
        sudo dnf -y install java-21-openjdk-devel
    fi
    ok "Java 21 installed"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Maven
# ─────────────────────────────────────────────────────────────────────────────
step "Checking Maven..."
if command -v mvn &>/dev/null; then
    ok "Maven present ($(mvn -version 2>&1 | head -1))"
else
    info "Installing Maven..."
    if [[ "$PKG_MGR" == "apt" ]]; then
        sudo apt-get install -y -q maven
    else
        sudo dnf -y install maven
    fi
    ok "Maven installed"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — Node.js 20
# ─────────────────────────────────────────────────────────────────────────────
step "Checking Node.js 20..."
NODE_OK=false
if command -v node &>/dev/null; then
    NODE_VER=$(node --version)
    if echo "$NODE_VER" | grep -q "^v20"; then
        ok "Node.js $NODE_VER present"
        NODE_OK=true
    else
        warn "Wrong Node.js version: $NODE_VER (need v20.x)"
    fi
fi

if [[ "$NODE_OK" == "false" ]]; then
    info "Installing Node.js 20 via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    if [[ "$PKG_MGR" == "apt" ]]; then
        sudo apt-get install -y -q nodejs
    else
        sudo dnf -y install nodejs
    fi
    ok "Node.js 20 installed ($(node --version))"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6 — GitHub Actions runner
# ─────────────────────────────────────────────────────────────────────────────
step "Setting up GitHub Actions runner in $RUNNER_DIR..."

if [[ -f "$RUNNER_DIR/.runner" ]]; then
    warn "Runner already configured at $RUNNER_DIR"
    warn "To reconfigure, remove the directory and re-run:"
    info "  rm -rf $RUNNER_DIR && bash $0 --token NEW_TOKEN"
else
    mkdir -p "$RUNNER_DIR"
    cd "$RUNNER_DIR"

    # Get the latest runner version
    RUNNER_VERSION=$(curl -s https://api.github.com/repos/actions/runner/releases/latest |
                     grep '"tag_name"' | sed 's/.*"v\([^"]*\)".*/\1/')
    RUNNER_ARCHIVE="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
    RUNNER_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${RUNNER_ARCHIVE}"

    info "Downloading runner v${RUNNER_VERSION}..."
    curl -fsSL -o "$RUNNER_ARCHIVE" "$RUNNER_URL"
    tar xzf "$RUNNER_ARCHIVE"
    rm "$RUNNER_ARCHIVE"
    ok "Runner agent downloaded"

    info "Configuring runner..."
    ./config.sh \
        --url "$REPO_URL" \
        --token "$RUNNER_TOKEN" \
        --name "$RUNNER_NAME" \
        --labels "$RUNNER_LABELS" \
        --work "_work" \
        --unattended

    ok "Runner configured"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 7 — Install as systemd service
# ─────────────────────────────────────────────────────────────────────────────
step "Installing runner as systemd service..."
cd "$RUNNER_DIR"

if systemctl is-active --quiet "actions.runner.*.homelab" 2>/dev/null ||
   systemctl is-active --quiet "actions.runner.*${RUNNER_NAME}*" 2>/dev/null; then
    ok "Runner service is already active"
else
    sudo ./svc.sh install
    sudo ./svc.sh start
    ok "Runner service installed and started"
fi

# Show status
SERVICE_NAME=$(sudo ./svc.sh status 2>/dev/null | grep "service name" | awk '{print $NF}' || true)
if [[ -n "$SERVICE_NAME" ]]; then
    sudo systemctl status "$SERVICE_NAME" --no-pager -l | head -8 | while read -r line; do
        info "$line"
    done
else
    sudo ./svc.sh status 2>/dev/null | head -5 | while read -r line; do info "$line"; done
fi

# ─────────────────────────────────────────────────────────────────────────────
# DONE
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}  ╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}  ║  Runner setup complete.                                   ║${NC}"
echo -e "${GREEN}  ║                                                           ║${NC}"
echo -e "${GREEN}  ║  Verify at:                                               ║${NC}"
echo -e "${GREEN}  ║  github.com/omprakash201194/spends/settings/actions/      ║${NC}"
echo -e "${GREEN}  ║  runners  →  '${RUNNER_NAME}' should show a green dot.    ║${NC}"
echo -e "${GREEN}  ║                                                           ║${NC}"
echo -e "${GREEN}  ║  Next step: push to main or run first-deploy.ps1          ║${NC}"
echo -e "${GREEN}  ╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
