# SpendStack — Homelab Server Setup Guide for Claude

This file is for a Claude session running **on the homelab server** (or assisting with homelab server tasks via SSH).
It contains everything needed to set up and operate SpendStack on the k3s cluster.

---

## Server Context

| Property | Value |
|---|---|
| Server | Dell OptiPlex 9020 |
| OS | Linux (Ubuntu/Debian based) |
| Tailscale IP | `100.76.108.123` |
| SSH user | `ogautam` |
| Kubernetes | k3s, single-node |
| Primary namespace | `homelab` |
| Container registry | `localhost:30500` (insecure, running in k3s) |
| Repo | https://github.com/omprakash201194/spends.git |

---

## What SpendStack Is

A self-hosted household expense manager. Two containers run in the `homelab` namespace:

| Deployment | Image | Purpose |
|---|---|---|
| `spends-backend` | `localhost:30500/homelab/spends-backend` | Spring Boot 3.3.4, Java 21, REST API |
| `spends-frontend` | `localhost:30500/homelab/spends-frontend` | React 18, served by nginx, proxies `/api/` to backend |

Ingress exposes only the frontend at `https://spends.homelab.local`. The backend is ClusterIP only — the nginx container in the frontend pod proxies API calls to it internally.

Database: the **existing** `postgres` StatefulSet in the `homelab` namespace (shared with other homelab services).

---

## Existing Cluster Resources SpendStack Depends On

Before running setup, verify these already exist:

```bash
# PostgreSQL StatefulSet
kubectl get statefulset postgres -n homelab

# PostgreSQL service
kubectl get svc postgres -n homelab

# PostgreSQL secret (must have key: POSTGRES_PASSWORD)
kubectl get secret postgres-secret -n homelab
kubectl get secret postgres-secret -n homelab -o jsonpath="{.data.POSTGRES_PASSWORD}" | base64 -d

# Nginx Ingress controller
kubectl get ingressclass nginx

# cert-manager and the homelab CA issuer
kubectl get clusterissuer homelab-ca-issuer
```

If any of these are missing, SpendStack cannot run. Do not proceed until they exist.

---

## Repository Layout (relevant to homelab)

```
spends/
├── HOMELAB-CLAUDE.md              ← this file
├── CLAUDE.md                      ← full project context for dev sessions
├── k8s/
│   ├── backend-deployment.yaml    ← spends-backend Deployment
│   ├── frontend-deployment.yaml   ← spends-frontend Deployment
│   ├── services.yaml              ← ClusterIP services for both
│   ├── ingress.yaml               ← spends.homelab.local + TLS
│   └── configmap.yaml             ← SPRING_PROFILES_ACTIVE=k8s
└── scripts/
    └── homelab/
        ├── setup-cluster.sh       ← run FIRST — secrets + manifests
        └── setup-runner.sh        ← run SECOND — CI runner + prereqs
```

---

## Setup Order

```
Step 1  →  Clone repo on homelab server
Step 2  →  Run setup-cluster.sh
Step 3  →  Run setup-runner.sh
Step 4  →  First deploy (from Windows dev machine, or manually here)
Step 5  →  Verify
```

---

## Step 1 — Clone the Repo

```bash
# Pick a location — home directory is fine
cd ~
git clone https://github.com/omprakash201194/spends.git
cd spends
```

If the repo is already cloned, pull latest:

```bash
cd ~/spends
git pull origin main
```

---

## Step 2 — Run setup-cluster.sh

This script is idempotent — safe to re-run.

```bash
bash scripts/homelab/setup-cluster.sh
```

### What it does

1. Verifies `kubectl` and cluster connectivity
2. Confirms the `homelab` namespace exists
3. Verifies `postgres-secret` exists with key `POSTGRES_PASSWORD`
4. Creates `spends-secret` containing the JWT signing key (skips if already exists)
5. Applies all manifests from `k8s/`

### Expected output

```
  ▶ Checking kubectl...
    ✓ Cluster reachable
        ogautam-homelab   Ready   control-plane   ...

  ▶ Verifying namespace 'homelab'...
    ✓ Namespace 'homelab' exists

  ▶ Checking postgres-secret...
    ✓ postgres-secret found

  ▶ Creating spends-secret (JWT signing key)...
    ✓ spends-secret created with a fresh 512-bit JWT key

  ▶ Applying Kubernetes manifests from .../k8s/...
    ✓ Manifests applied

  ▶ Current pod status...
      Pods may be in Pending/ImagePullBackOff until images are pushed — that is expected.
```

### After this step — pods will be in ImagePullBackOff

This is **expected**. The deployments exist but there are no images in the registry yet. They will be fixed after Step 4 (first deploy).

```bash
# You will see something like this — this is normal at this stage:
kubectl get pods -n homelab -l "app in (spends-backend,spends-frontend)"
# NAME                               READY   STATUS             RESTARTS
# spends-backend-xxx                 0/1     ImagePullBackOff   0
# spends-frontend-xxx                0/1     ImagePullBackOff   0
```

### Verify secrets were created correctly

```bash
# Should show both secrets
kubectl get secrets -n homelab | grep -E "postgres-secret|spends-secret"

# Confirm spends-secret has the jwt-secret key
kubectl get secret spends-secret -n homelab -o jsonpath="{.data.jwt-secret}" | base64 -d | wc -c
# Should print a number > 80 (the base64-encoded 512-bit key)
```

### Backup the JWT secret

The JWT secret is not stored anywhere else. Back it up:

```bash
kubectl get secret spends-secret -n homelab -o yaml > ~/spends-secret-backup.yaml
# Store this file somewhere safe — NOT in the git repo
```

---

## Step 3 — Run setup-runner.sh

Get a runner token first:
1. Go to https://github.com/omprakash201194/spends/settings/actions/runners
2. Click **New self-hosted runner** → **Linux** → **x64**
3. Copy the token from the `./config.sh` command shown on that page (starts with `A...`)

The token expires in ~1 hour. Run the script promptly.

```bash
bash scripts/homelab/setup-runner.sh --token YOUR_TOKEN_HERE
```

### What it installs

| Tool | Purpose | Check |
|---|---|---|
| Docker Engine | Build container images in CI | `docker --version` |
| Java 21 (Temurin) | Build Spring Boot backend jar | `java -version` |
| Maven | Build tool | `mvn -version` |
| Node.js 20 | Build React frontend | `node --version` |
| GitHub Actions runner | Executes deploy jobs from GitHub | `systemctl status actions.runner.*` |

### Docker insecure registry

The script configures `/etc/docker/daemon.json` to allow pushing/pulling from `localhost:30500` (the k3s-hosted Docker registry) without TLS:

```json
{ "insecure-registries": ["localhost:30500"] }
```

### Verify runner is registered

```bash
# Service should be active
sudo systemctl status "actions.runner.*homelab*" --no-pager

# Also check on GitHub:
# https://github.com/omprakash201194/spends/settings/actions/runners
# The runner named 'homelab' should show a green dot (Idle)
```

### If the runner token expired

Generate a new token from GitHub and re-run:

```bash
cd ~/spends
bash scripts/homelab/setup-runner.sh --token NEW_TOKEN
```

---

## Step 4 — First Deploy

### Option A — From the Windows dev machine (recommended)

On the Windows machine:
```powershell
cd f:\Development\home-lab\spends
.\scripts\windows\first-deploy.ps1
```

This builds the Docker images on Windows, pushes them to `100.76.108.123:30500` over Tailscale, and runs `kubectl apply`.

### Option B — Directly on the homelab server

If you want to build and push from the server itself:

```bash
cd ~/spends

# Build backend jar
cd backend
mvn package -DskipTests -q
cd ..

# Build and push backend image
docker build -t localhost:30500/homelab/spends-backend:1.0.0 backend/
docker push localhost:30500/homelab/spends-backend:1.0.0
docker tag localhost:30500/homelab/spends-backend:1.0.0 localhost:30500/homelab/spends-backend:latest
docker push localhost:30500/homelab/spends-backend:latest

# Install frontend deps and build
cd frontend && npm ci && npm run build && cd ..

# Build and push frontend image
docker build -t localhost:30500/homelab/spends-frontend:1.0.0 frontend/
docker push localhost:30500/homelab/spends-frontend:1.0.0
docker tag localhost:30500/homelab/spends-frontend:1.0.0 localhost:30500/homelab/spends-frontend:latest
docker push localhost:30500/homelab/spends-frontend:latest

# Roll out
kubectl set image deployment/spends-backend  spends-backend=localhost:30500/homelab/spends-backend:1.0.0  -n homelab
kubectl set image deployment/spends-frontend spends-frontend=localhost:30500/homelab/spends-frontend:1.0.0 -n homelab
```

---

## Step 5 — Verify Everything

### Pods running

```bash
kubectl get pods -n homelab -l "app in (spends-backend,spends-frontend)"
# Expected:
# NAME                               READY   STATUS    RESTARTS
# spends-backend-xxx                 1/1     Running   0
# spends-frontend-xxx                1/1     Running   0
```

### Backend health

```bash
kubectl port-forward -n homelab svc/spends-backend 8099:8080 &
sleep 5
curl -s http://localhost:8099/actuator/health | python3 -m json.tool
# Expected: { "status": "UP" }
kill %1
```

### Ingress

```bash
kubectl get ingress -n homelab spends-ingress
# Should show: spends.homelab.local   ...   80, 443
```

### TLS certificate

```bash
kubectl get certificate -n homelab spends-tls
# READY should be True
```

### End-to-end from the server

```bash
curl -sk https://spends.homelab.local | grep -o '<title>.*</title>'
# Expected: <title>SpendStack</title>
```

---

## Ongoing Operations

### View logs

```bash
# Backend logs (live)
kubectl logs -n homelab -l app=spends-backend -f

# Frontend logs (nginx)
kubectl logs -n homelab -l app=spends-frontend -f

# Last 100 lines of backend
kubectl logs -n homelab -l app=spends-backend --tail=100
```

### Restart a deployment

```bash
kubectl rollout restart deployment/spends-backend  -n homelab
kubectl rollout restart deployment/spends-frontend -n homelab
```

### Roll out a new image version

```bash
# After pushing image :1.0.1 to the registry
kubectl set image deployment/spends-backend \
  spends-backend=localhost:30500/homelab/spends-backend:1.0.1 \
  -n homelab
kubectl rollout status deployment/spends-backend -n homelab --timeout=120s
```

### Check CI runner status

```bash
sudo systemctl status "actions.runner.*homelab*" --no-pager -l
```

### Rotate the JWT secret

All existing sessions will be invalidated — users will need to log in again.

```bash
NEW_SECRET=$(openssl rand -base64 64 | tr -d '\n')
kubectl create secret generic spends-secret \
  --from-literal=jwt-secret="$NEW_SECRET" \
  -n homelab \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart backend to pick up new secret
kubectl rollout restart deployment/spends-backend -n homelab
```

### What lives in the registry

```bash
curl -s http://localhost:30500/v2/_catalog | python3 -m json.tool
# Lists all images in the local registry

curl -s http://localhost:30500/v2/homelab/spends-backend/tags/list | python3 -m json.tool
curl -s http://localhost:30500/v2/homelab/spends-frontend/tags/list | python3 -m json.tool
```

---

## Troubleshooting

### Pod stuck in ImagePullBackOff

```bash
kubectl describe pod -n homelab -l app=spends-backend | grep -A5 "Events:"
```

Common causes:
- Images haven't been pushed yet → run first-deploy.ps1 from Windows
- Wrong image tag in the deployment → check `kubectl get deployment spends-backend -n homelab -o yaml | grep image:`
- Registry not reachable → `curl http://localhost:30500/v2/_catalog`

### Backend CrashLoopBackOff

```bash
kubectl logs -n homelab -l app=spends-backend --previous
```

Common causes:
- `spends-secret` missing or wrong key name → `kubectl describe pod ... | grep -A3 "Environment"`
- `postgres-secret` key mismatch → key must be `POSTGRES_PASSWORD`
- Liquibase migration failed → look for `liquibase` in the logs
- PostgreSQL not reachable → `kubectl get pods -n homelab | grep postgres`

### Frontend returns 502 Bad Gateway

The nginx container can't reach `spends-backend:8080`.

```bash
# Check backend service exists and has endpoints
kubectl get svc spends-backend -n homelab
kubectl get endpoints spends-backend -n homelab
# Endpoints should show a pod IP, not '<none>'

# Check backend pod is actually running
kubectl get pods -n homelab -l app=spends-backend
```

### TLS certificate not issued

```bash
kubectl describe certificate spends-tls -n homelab
kubectl describe certificaterequest -n homelab | tail -20
kubectl logs -n cert-manager -l app=cert-manager --tail=50
```

Make sure `homelab-ca-issuer` ClusterIssuer exists:
```bash
kubectl get clusterissuer homelab-ca-issuer
```

### CI runner not picking up jobs

```bash
# Check service is running
sudo systemctl status "actions.runner.*" --no-pager

# Check runner logs
sudo journalctl -u "actions.runner.*homelab*" -n 50 --no-pager

# Restart if needed
sudo systemctl restart "actions.runner.*homelab*"
```

---

## k8s Resources Summary

After full setup, these resources should exist in the `homelab` namespace:

```bash
kubectl get all,ingress,secret,configmap -n homelab \
  -l "app in (spends-backend,spends-frontend)" 2>/dev/null

kubectl get secret spends-secret    -n homelab
kubectl get configmap spends-config -n homelab
kubectl get ingress spends-ingress  -n homelab
kubectl get certificate spends-tls  -n homelab
```

| Resource | Name |
|---|---|
| Deployment | `spends-backend` |
| Deployment | `spends-frontend` |
| Service (ClusterIP) | `spends-backend` |
| Service (ClusterIP) | `spends-frontend` |
| Ingress | `spends-ingress` |
| Certificate | `spends-tls` |
| Secret | `spends-secret` (JWT key) |
| Secret | `postgres-secret` (pre-existing, shared) |
| ConfigMap | `spends-config` |
