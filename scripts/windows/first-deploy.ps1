#Requires -Version 5.1
<#
.SYNOPSIS
    First-time manual deploy of SpendStack to the homelab k3s cluster.

.DESCRIPTION
    Run this from your Windows machine AFTER:
      - setup-hosts.ps1 has been run (hosts file + Docker registry config)
      - spends-secret has been created on the cluster (JWT key)
      - Tailscale is connected

    This script:
      1. Builds the Spring Boot backend jar
      2. Builds and pushes the backend Docker image
      3. Builds the React frontend
      4. Builds and pushes the frontend Docker image
      5. Applies all Kubernetes manifests
      6. Waits for the rollout to complete
      7. Verifies the app is reachable

.PARAMETER Version
    Image tag to use. Defaults to "1.0.0".

.EXAMPLE
    .\scripts\windows\first-deploy.ps1
    .\scripts\windows\first-deploy.ps1 -Version "1.0.1"
#>

param(
    [string]$Version = "1.0.0"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root        = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$BackendDir  = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"
$K8sDir      = Join-Path $Root "k8s"

$REGISTRY    = "100.76.108.123:30500"
$BACKEND_IMG = "$REGISTRY/homelab/spends-backend:$Version"
$FRONTEND_IMG= "$REGISTRY/homelab/spends-frontend:$Version"
$NAMESPACE   = "homelab"

function Write-Step { param($m) Write-Host "`n  $m" -ForegroundColor Cyan }
function Write-OK   { param($m) Write-Host "    OK  $m" -ForegroundColor Green }
function Write-Fail { param($m) Write-Host "    XX  $m" -ForegroundColor Red; exit 1 }
function Write-Info { param($m) Write-Host "        $m" -ForegroundColor Gray }

Write-Host ""
Write-Host "  +------------------------------------------+" -ForegroundColor Blue
Write-Host "  |   SpendStack -- First Deploy v$Version" -ForegroundColor Blue
Write-Host "  +------------------------------------------+" -ForegroundColor Blue

# -----------------------------------------------------------------------------
# Pre-flight checks
# -----------------------------------------------------------------------------
Write-Step "Pre-flight checks..."

foreach ($cmd in @("docker", "kubectl", "mvn", "npm")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Fail "$cmd not found on PATH."
    }
    Write-OK "$cmd found"
}

# Tailscale / cluster reachability
try {
    kubectl get nodes --no-headers 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw }
    Write-OK "Cluster reachable"
} catch {
    Write-Fail "Cannot reach k3s cluster. Is Tailscale connected? Check: kubectl get nodes"
}

# spends-secret must already exist
try {
    kubectl get secret spends-secret -n $NAMESPACE 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw }
    Write-OK "spends-secret exists in namespace $NAMESPACE"
} catch {
    Write-Fail "'spends-secret' not found in namespace $NAMESPACE. Create it first:`n    kubectl create secret generic spends-secret --from-literal=jwt-secret=<key> -n homelab"
}

# -----------------------------------------------------------------------------
# STEP 1 -- Build backend jar
# -----------------------------------------------------------------------------
Write-Step "Building backend jar (Maven)..."
Push-Location $BackendDir
try {
    mvn package -DskipTests -B -q
    if ($LASTEXITCODE -ne 0) { Write-Fail "Maven build failed." }
} finally {
    Pop-Location
}
Write-OK "Backend jar built -> backend/target/"

# -----------------------------------------------------------------------------
# STEP 2 -- Build and push backend image
# -----------------------------------------------------------------------------
Write-Step "Building backend Docker image ($BACKEND_IMG)..."
docker build -t $BACKEND_IMG $BackendDir
if ($LASTEXITCODE -ne 0) { Write-Fail "docker build failed for backend." }
Write-OK "Backend image built"

Write-Info "Pushing to registry..."
docker push $BACKEND_IMG
if ($LASTEXITCODE -ne 0) { Write-Fail "docker push failed for backend. Is Docker Desktop configured for insecure registry $REGISTRY ?" }
Write-OK "Backend image pushed"

# Tag as :latest too
docker tag $BACKEND_IMG "$REGISTRY/homelab/spends-backend:latest"
docker push "$REGISTRY/homelab/spends-backend:latest" | Out-Null

# -----------------------------------------------------------------------------
# STEP 3 -- Build frontend
# -----------------------------------------------------------------------------
Write-Step "Installing frontend dependencies..."
Push-Location $FrontendDir
try {
    if (-not (Test-Path "node_modules")) {
        npm ci --silent
        if ($LASTEXITCODE -ne 0) { Write-Fail "npm ci failed." }
    }
    Write-OK "Dependencies ready"

    Write-Step "Building frontend (Vite)..."
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Fail "npm run build failed." }
    Write-OK "Frontend built -> frontend/dist/"
} finally {
    Pop-Location
}

# -----------------------------------------------------------------------------
# STEP 4 -- Build and push frontend image
# -----------------------------------------------------------------------------
Write-Step "Building frontend Docker image ($FRONTEND_IMG)..."
docker build -t $FRONTEND_IMG $FrontendDir
if ($LASTEXITCODE -ne 0) { Write-Fail "docker build failed for frontend." }
Write-OK "Frontend image built"

Write-Info "Pushing to registry..."
docker push $FRONTEND_IMG
if ($LASTEXITCODE -ne 0) { Write-Fail "docker push failed for frontend." }
Write-OK "Frontend image pushed"

docker tag $FRONTEND_IMG "$REGISTRY/homelab/spends-frontend:latest"
docker push "$REGISTRY/homelab/spends-frontend:latest" | Out-Null

# -----------------------------------------------------------------------------
# STEP 5 -- Apply Kubernetes manifests
# -----------------------------------------------------------------------------
Write-Step "Applying Kubernetes manifests..."
kubectl apply -f $K8sDir -n $NAMESPACE
if ($LASTEXITCODE -ne 0) { Write-Fail "kubectl apply failed." }
Write-OK "Manifests applied"

# Point deployments at the versioned image
kubectl set image deployment/spends-backend  spends-backend="localhost:30500/homelab/spends-backend:$Version"  -n $NAMESPACE
kubectl set image deployment/spends-frontend spends-frontend="localhost:30500/homelab/spends-frontend:$Version" -n $NAMESPACE

# -----------------------------------------------------------------------------
# STEP 6 -- Wait for rollout
# -----------------------------------------------------------------------------
Write-Step "Waiting for rollout..."
kubectl rollout status deployment/spends-backend  -n $NAMESPACE --timeout=120s
kubectl rollout status deployment/spends-frontend -n $NAMESPACE --timeout=60s
Write-OK "Rollout complete"

# -----------------------------------------------------------------------------
# STEP 7 -- Verify
# -----------------------------------------------------------------------------
Write-Step "Verifying pods..."
kubectl get pods -n $NAMESPACE -l "app in (spends-backend,spends-frontend)" --no-headers |
    ForEach-Object { Write-Info $_ }

Write-Step "Checking backend health via kubectl port-forward..."
$pfProc = Start-Process "kubectl" `
    -ArgumentList "port-forward -n $NAMESPACE svc/spends-backend 18080:8080" `
    -WindowStyle Hidden -PassThru

Start-Sleep -Seconds 5
try {
    $health = Invoke-RestMethod "http://localhost:18080/actuator/health" -TimeoutSec 10
    Write-OK "Backend health: $($health.status)"
} catch {
    Write-Info "Health check inconclusive -- check logs:"
    Write-Info "  kubectl logs -n $NAMESPACE -l app=spends-backend --tail=50"
} finally {
    Stop-Process -Id $pfProc.Id -Force -ErrorAction SilentlyContinue
}

# -----------------------------------------------------------------------------
# DONE
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "  +------------------------------------------------------+" -ForegroundColor Green
Write-Host "  |  Deploy complete -- v$Version" -ForegroundColor Green
Write-Host "  |                                                      |" -ForegroundColor Green
Write-Host "  |  Open: https://spends.homelab.local                  |" -ForegroundColor Green
Write-Host "  |                                                      |" -ForegroundColor Green
Write-Host "  |  Logs:                                               |" -ForegroundColor Green
Write-Host "  |    kubectl logs -n homelab -l app=spends-backend -f  |" -ForegroundColor Green
Write-Host "  +------------------------------------------------------+" -ForegroundColor Green
Write-Host ""
