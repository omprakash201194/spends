#Requires -Version 5.1
<#
.SYNOPSIS
    Start SpendStack locally for development.

.DESCRIPTION
    This script:
      1. Checks all prerequisites (kubectl, java, mvn, node)
      2. Retrieves the DB password from the k8s secret automatically
      3. Generates and saves a JWT secret on first run (stored in .dev-secrets)
      4. Starts kubectl port-forward for PostgreSQL in the background
      5. Launches the Spring Boot backend in a new terminal window
      6. Waits for the backend to be healthy
      7. Launches the React frontend dev server in a new terminal window
      8. Opens the app in your browser

.EXAMPLE
    .\dev-start.ps1

.EXAMPLE
    .\dev-start.ps1 -Stop    # Stop all running dev processes
#>

param(
    [switch]$Stop
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Paths ─────────────────────────────────────────────────────────────────────
$Root          = $PSScriptRoot
$BackendDir    = Join-Path $Root "backend"
$FrontendDir   = Join-Path $Root "frontend"
$SecretsFile   = Join-Path $Root ".dev-secrets"   # gitignored — stores JWT secret
$PidFile       = Join-Path $Root ".dev-pids"      # tracks process IDs for -Stop

# ── Colours ───────────────────────────────────────────────────────────────────
function Write-Step  { param($m) Write-Host "`n  $m" -ForegroundColor Cyan }
function Write-OK    { param($m) Write-Host "    OK  $m" -ForegroundColor Green }
function Write-Warn  { param($m) Write-Host "    !! $m" -ForegroundColor Yellow }
function Write-Fail  { param($m) Write-Host "    XX $m" -ForegroundColor Red; exit 1 }
function Write-Info  { param($m) Write-Host "       $m" -ForegroundColor Gray }

# ─────────────────────────────────────────────────────────────────────────────
# STOP mode — kill everything we started
# ─────────────────────────────────────────────────────────────────────────────
if ($Stop) {
    Write-Host "`n  Stopping SpendStack dev processes..." -ForegroundColor Yellow

    # Kill processes saved in pid file
    if (Test-Path $PidFile) {
        $pids = Get-Content $PidFile
        foreach ($id in $pids) {
            try {
                $proc = Get-Process -Id $id -ErrorAction SilentlyContinue
                if ($proc) {
                    $proc | Stop-Process -Force
                    Write-Host "    Stopped PID $id ($($proc.Name))" -ForegroundColor Gray
                }
            } catch { }
        }
        Remove-Item $PidFile -Force
    }

    # Kill any remaining port-forward and backend processes by name/port
    Get-Process -Name "kubectl" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*port-forward*" } |
        Stop-Process -Force -ErrorAction SilentlyContinue

    Write-Host "`n  All dev processes stopped.`n" -ForegroundColor Green
    exit 0
}

# ─────────────────────────────────────────────────────────────────────────────
# BANNER
# ─────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "  ║      SpendStack — Dev Launcher       ║" -ForegroundColor Blue
Write-Host "  ╚══════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

$pidsToTrack = @()

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Prerequisites
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Checking prerequisites..."

$tools = @(
    @{ cmd = "kubectl"; args = "version --client --short 2>$null"; label = "kubectl" },
    @{ cmd = "java";    args = "-version 2>&1 | Select-String '21'"; label = "Java 21" },
    @{ cmd = "mvn";     args = "-version 2>$null"; label = "Maven" },
    @{ cmd = "node";    args = "--version 2>$null"; label = "Node.js" },
    @{ cmd = "npm";     args = "--version 2>$null"; label = "npm" }
)

foreach ($t in $tools) {
    $found = Get-Command $t.cmd -ErrorAction SilentlyContinue
    if (-not $found) {
        Write-Fail "$($t.label) not found — install it and re-run."
    }
    Write-OK "$($t.label)  ($($found.Source))"
}

# Check Java is version 21
$javaVer = & java -version 2>&1 | Select-String "version"
if ($javaVer -notmatch '"21') {
    Write-Warn "Java version may not be 21. Found: $javaVer"
    Write-Warn "Spring Boot requires Java 21. Install: winget install EclipseAdoptium.Temurin.21.JDK"
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Verify cluster connectivity
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Verifying cluster connectivity..."
try {
    $nodes = kubectl get nodes --no-headers 2>&1
    if ($LASTEXITCODE -ne 0) { throw "kubectl failed" }
    Write-OK "Cluster reachable"
    Write-Info ($nodes | Out-String).Trim()
} catch {
    Write-Fail "Cannot reach the k3s cluster. Make sure Tailscale is connected and kubeconfig is set."
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Retrieve DB password from k8s secret
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Retrieving DB password from k8s secret (postgres-secret)..."
try {
    $encoded = kubectl get secret postgres-secret -n homelab `
        -o jsonpath="{.data.password}" 2>&1
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($encoded)) {
        throw "Secret not found"
    }
    $DB_PASSWORD = [System.Text.Encoding]::UTF8.GetString(
        [System.Convert]::FromBase64String($encoded.Trim())
    )
    Write-OK "DB password retrieved (${DB_PASSWORD.Length} chars)"
} catch {
    Write-Fail "Could not read 'postgres-secret' from the homelab namespace. Is the cluster reachable and the secret present?"
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — JWT secret (generate once, persist in .dev-secrets)
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Loading JWT secret..."

if (Test-Path $SecretsFile) {
    $APP_JWT_SECRET = Get-Content $SecretsFile -Raw
    $APP_JWT_SECRET = $APP_JWT_SECRET.Trim()
    Write-OK "Loaded existing JWT secret from .dev-secrets"
} else {
    # Generate a 64-byte (512-bit) Base64-encoded secret — well above the 256-bit minimum
    $bytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(64)
    $APP_JWT_SECRET = [System.Convert]::ToBase64String($bytes)
    $APP_JWT_SECRET | Set-Content $SecretsFile -NoNewline
    Write-OK "Generated new JWT secret and saved to .dev-secrets"
    Write-Info "(This file is gitignored — keep it safe, don't commit it)"
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — PostgreSQL port-forward
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Starting PostgreSQL port-forward (localhost:5432 → postgres.homelab)..."

# Kill any existing port-forward on 5432
$existing = netstat -ano 2>$null |
    Select-String ":5432 " |
    ForEach-Object { ($_ -split '\s+')[-1] } |
    Select-Object -First 1
if ($existing -and $existing -match '^\d+$') {
    try {
        Stop-Process -Id ([int]$existing) -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
        Write-Info "Killed existing process on port 5432 (PID $existing)"
    } catch { }
}

$pfProcess = Start-Process "kubectl" `
    -ArgumentList "port-forward -n homelab svc/postgres 5432:5432" `
    -WindowStyle Hidden `
    -PassThru

$pidsToTrack += $pfProcess.Id

# Wait for port-forward to be ready
Write-Info "Waiting for port 5432..."
$pfReady = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    $conn = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue
    if ($conn.TcpTestSucceeded) { $pfReady = $true; break }
}
if (-not $pfReady) {
    Write-Fail "PostgreSQL port-forward did not become ready on localhost:5432. Check Tailscale and cluster status."
}
Write-OK "PostgreSQL ready on localhost:5432 (PID $($pfProcess.Id))"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6 — Install frontend dependencies (if needed)
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Checking frontend dependencies..."
$nodeModules = Join-Path $FrontendDir "node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Info "node_modules not found — running npm install..."
    Push-Location $FrontendDir
    & npm install --silent
    Pop-Location
    Write-OK "Frontend dependencies installed"
} else {
    Write-OK "node_modules present (skip install)"
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 7 — Launch backend in a new terminal window
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Launching Spring Boot backend..."

$backendCmd = @"
`$env:DB_PASSWORD     = '$DB_PASSWORD'
`$env:APP_JWT_SECRET  = '$APP_JWT_SECRET'
`$Host.UI.RawUI.WindowTitle = 'SpendStack — Backend'
Write-Host '  SpendStack Backend' -ForegroundColor Cyan
Write-Host '  Profile : local'    -ForegroundColor Gray
Write-Host '  Port    : 8080'     -ForegroundColor Gray
Write-Host ''
Set-Location '$BackendDir'
mvn spring-boot:run '-Dspring-boot.run.profiles=local'
"@

$backendProcess = Start-Process "powershell" `
    -ArgumentList "-NoExit", "-Command", $backendCmd `
    -PassThru

$pidsToTrack += $backendProcess.Id
Write-OK "Backend window opened (PID $($backendProcess.Id))"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 8 — Wait for backend health endpoint
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Waiting for backend to be healthy (http://localhost:8080/actuator/health)..."
Write-Info "This takes ~20-30 seconds for Spring Boot to start..."

$backendReady = $false
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    try {
        $resp = Invoke-RestMethod "http://localhost:8080/actuator/health" -TimeoutSec 2 -ErrorAction Stop
        if ($resp.status -eq "UP") { $backendReady = $true; break }
    } catch { }
    if ($i % 5 -eq 4) { Write-Info "Still waiting... ($([int](($i+1)*2))s)" }
}

if (-not $backendReady) {
    Write-Warn "Backend health check timed out. It may still be starting — check the backend window."
} else {
    Write-OK "Backend is UP"
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 9 — Launch frontend in a new terminal window
# ─────────────────────────────────────────────────────────────────────────────
Write-Step "Launching React frontend..."

$frontendCmd = @"
`$Host.UI.RawUI.WindowTitle = 'SpendStack — Frontend'
Write-Host '  SpendStack Frontend' -ForegroundColor Cyan
Write-Host '  Dev server : http://localhost:5173' -ForegroundColor Gray
Write-Host '  API proxy  : /api -> http://localhost:8080' -ForegroundColor Gray
Write-Host ''
Set-Location '$FrontendDir'
npm run dev
"@

$frontendProcess = Start-Process "powershell" `
    -ArgumentList "-NoExit", "-Command", $frontendCmd `
    -PassThru

$pidsToTrack += $frontendProcess.Id
Write-OK "Frontend window opened (PID $($frontendProcess.Id))"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 10 — Wait for frontend and open browser
# ─────────────────────────────────────────────────────────────────────────────
Write-Info "Waiting for frontend dev server..."
Start-Sleep -Seconds 5

$frontendReady = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    try {
        $null = Invoke-WebRequest "http://localhost:5173" -TimeoutSec 2 -ErrorAction Stop
        $frontendReady = $true; break
    } catch { }
}

if ($frontendReady) {
    Write-OK "Frontend ready — opening browser..."
    Start-Process "http://localhost:5173"
} else {
    Write-Warn "Frontend not ready yet — open http://localhost:5173 manually once it starts."
}

# ─────────────────────────────────────────────────────────────────────────────
# Save PIDs for -Stop
# ─────────────────────────────────────────────────────────────────────────────
$pidsToTrack | Set-Content $PidFile

# ─────────────────────────────────────────────────────────────────────────────
# DONE
# ─────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║  SpendStack is running!                              ║" -ForegroundColor Green
Write-Host "  ║                                                      ║" -ForegroundColor Green
Write-Host "  ║  App      http://localhost:5173                      ║" -ForegroundColor Green
Write-Host "  ║  API      http://localhost:8080/api                  ║" -ForegroundColor Green
Write-Host "  ║  Health   http://localhost:8080/actuator/health      ║" -ForegroundColor Green
Write-Host "  ║                                                      ║" -ForegroundColor Green
Write-Host "  ║  To stop:  .\dev-start.ps1 -Stop                    ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
