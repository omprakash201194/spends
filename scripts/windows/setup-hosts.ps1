#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Add spends.homelab.local to the Windows hosts file and configure
    Docker Desktop for the homelab insecure registry.

.DESCRIPTION
    Run this once on your Windows development machine.
    Must be run as Administrator.
#>

$HOMELAB_IP   = "100.76.108.123"
$HOSTNAME     = "spends.homelab.local"
$HOSTS_FILE   = "C:\Windows\System32\drivers\etc\hosts"
$REGISTRY     = "${HOMELAB_IP}:30500"

function Write-Step { param($m) Write-Host "`n  $m" -ForegroundColor Cyan }
function Write-OK   { param($m) Write-Host "    OK  $m" -ForegroundColor Green }
function Write-Skip { param($m) Write-Host "    --  $m" -ForegroundColor Gray }
function Write-Warn { param($m) Write-Host "    !!  $m" -ForegroundColor Yellow }

Write-Host ""
Write-Host "  ╔══════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "  ║   SpendStack — Windows Setup         ║" -ForegroundColor Blue
Write-Host "  ╚══════════════════════════════════════╝" -ForegroundColor Blue

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Hosts file
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Configuring hosts file ($HOSTS_FILE)..."

$hostsContent = Get-Content $HOSTS_FILE -Raw
$entry        = "$HOMELAB_IP  $HOSTNAME"

if ($hostsContent -match [regex]::Escape($HOSTNAME)) {
    Write-Skip "$HOSTNAME already present — skipping"
} else {
    Add-Content -Path $HOSTS_FILE -Value "`n$entry"
    Write-OK "Added: $entry"
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Flush DNS
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Flushing DNS cache..."
ipconfig /flushdns | Out-Null
Write-OK "DNS cache flushed"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Verify hostname resolves
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Verifying $HOSTNAME resolves..."
try {
    $resolved = [System.Net.Dns]::GetHostAddresses($HOSTNAME) | Select-Object -First 1
    Write-OK "$HOSTNAME → $resolved"
} catch {
    Write-Warn "Could not resolve $HOSTNAME — make sure Tailscale is connected."
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Docker Desktop insecure registry
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Configuring Docker Desktop for insecure registry ($REGISTRY)..."

$dockerConfigPath = "$env:USERPROFILE\.docker\daemon.json"

# Ensure .docker dir exists
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.docker" | Out-Null

if (Test-Path $dockerConfigPath) {
    $raw  = Get-Content $dockerConfigPath -Raw
    $json = $raw | ConvertFrom-Json -AsHashtable -ErrorAction SilentlyContinue

    if ($json -and $json.ContainsKey("insecure-registries") -and
        $json["insecure-registries"] -contains $REGISTRY) {
        Write-Skip "$REGISTRY already in insecure-registries"
    } else {
        Write-Warn "Docker daemon.json already exists. Add the following manually in"
        Write-Warn "Docker Desktop → Settings → Docker Engine:"
        Write-Host ""
        Write-Host "    `"insecure-registries`": [`"$REGISTRY`"]" -ForegroundColor White
        Write-Host ""
        Write-Warn "Then click Apply & Restart."
    }
} else {
    # Create a fresh daemon.json
    $config = @{ "insecure-registries" = @($REGISTRY) } | ConvertTo-Json
    $config | Set-Content $dockerConfigPath
    Write-OK "Created $dockerConfigPath with insecure registry"
    Write-Warn "Restart Docker Desktop for the change to take effect."
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — Verify Docker is running
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Checking Docker Desktop..."
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Write-Warn "Docker not found. Install: winget install Docker.DockerDesktop"
} else {
    try {
        $info = docker info 2>&1
        if ($LASTEXITCODE -eq 0) {
            $insecure = ($info | Select-String "Insecure Registries" -A 5 |
                         Select-String $REGISTRY)
            if ($insecure) {
                Write-OK "Docker running and insecure registry confirmed"
            } else {
                Write-Warn "Docker running but $REGISTRY not yet in insecure list"
                Write-Warn "Restart Docker Desktop after updating daemon.json"
            }
        } else {
            Write-Warn "Docker is installed but not running — start Docker Desktop"
        }
    } catch {
        Write-Warn "Could not query Docker — is Docker Desktop running?"
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# DONE
# ─────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║  Windows setup complete.                               ║" -ForegroundColor Green
Write-Host "  ║                                                        ║" -ForegroundColor Green
Write-Host "  ║  Next steps:                                           ║" -ForegroundColor Green
Write-Host "  ║  1. Restart Docker Desktop (if daemon.json changed)    ║" -ForegroundColor Green
Write-Host "  ║  2. Make sure Tailscale is connected                   ║" -ForegroundColor Green
Write-Host "  ║  3. Run: .\dev-start.ps1  (local dev)                 ║" -ForegroundColor Green
Write-Host "  ║     OR                                                 ║" -ForegroundColor Green
Write-Host "  ║     Run: .\scripts\windows\first-deploy.ps1 (homelab) ║" -ForegroundColor Green
Write-Host "  ╚════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
