#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# scripts/linux/runner-setup.sh
#
# Installs and registers a GitHub Actions self-hosted runner on the homelab
# server, then installs it as a systemd service so it survives reboots.
#
# Usage:
#   1. Go to https://github.com/omprakash201194/spends/settings/actions/runners
#   2. Click "New self-hosted runner" → Linux x64 → copy the token shown.
#   3. Run this script as the user that should own the runner process:
#        bash scripts/linux/runner-setup.sh <REGISTRATION_TOKEN>
#
# The token expires after 1 hour; request a fresh one if registration fails.
# -----------------------------------------------------------------------------
set -euo pipefail

REPO_URL="https://github.com/omprakash201194/spends"
RUNNER_VERSION="2.317.0"
INSTALL_DIR="$HOME/actions-runner"
RUNNER_NAME="${RUNNER_NAME:-homelab-runner}"

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <REGISTRATION_TOKEN>"
  echo "Get a token at: $REPO_URL/settings/actions/runners/new"
  exit 1
fi

TOKEN="$1"

# ── 1. Download runner ────────────────────────────────────────────────────────
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

ARCHIVE="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
if [ ! -f "$ARCHIVE" ]; then
  echo "[runner] downloading $ARCHIVE ..."
  curl -sL \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${ARCHIVE}" \
    -o "$ARCHIVE"
fi

tar xzf "$ARCHIVE"

# ── 2. Register with GitHub ───────────────────────────────────────────────────
echo "[runner] registering runner '$RUNNER_NAME' ..."
./config.sh \
  --url "$REPO_URL" \
  --token "$TOKEN" \
  --name "$RUNNER_NAME" \
  --labels "self-hosted,homelab,linux,x64" \
  --work "_work" \
  --unattended \
  --replace

# ── 3. Install as systemd service ────────────────────────────────────────────
echo "[runner] installing systemd service ..."
sudo ./svc.sh install "$(whoami)"
sudo ./svc.sh start

echo ""
echo "[runner] done. Service status:"
sudo ./svc.sh status

echo ""
echo "The runner will start automatically on reboot."
echo "Manage with:  sudo $INSTALL_DIR/svc.sh {start|stop|status|uninstall}"
