# SpendStack — CLAUDE.md

Project context for Claude Code. Keep this file updated as phases are completed.

---

## What We Are Building

**SpendStack** — a self-hosted personal expense manager for a household.

- Parses ICICI bank statement XLS exports (10 years of history, ~8,300+ transactions)
- Multi-user, household-scoped (members share a view; admin creates the household)
- Runs on the homelab k3s cluster at `https://spends.homelab.local`
- Future-ready for multiple banks and additional statement formats

---

## Tech Stack

| Layer | Choice |
|---|---|
| Backend | Spring Boot 3.3.4, Java 21, Maven |
| Frontend | React 18 + TypeScript, Vite 5, TailwindCSS 3 |
| Database | PostgreSQL (existing homelab StatefulSet) |
| Migrations | Liquibase |
| Auth | JWT (JJWT 0.12.6), BCrypt |
| State | Zustand (frontend) |
| Data fetching | TanStack Query v5 |
| Charts | Recharts |
| XLS parsing | Apache POI 5.3 |
| Container registry | `100.76.108.123:30500` (insecure, homelab) |
| Orchestration | k3s, `homelab` namespace |
| CI/CD | GitHub Actions — build/test on GitHub runners, deploy on self-hosted runner |

**GitHub repo:** https://github.com/omprakash201194/spends.git

---

## Architecture

```
spends.homelab.local (HTTPS, TLS via cert-manager)
        │
        ▼
  [spends-frontend]  nginx container
        │  proxies /api/* internally
        ▼
  [spends-backend]   Spring Boot, ClusterIP only
        │
        ▼
  PostgreSQL (homelab namespace, existing StatefulSet)
```

- Frontend nginx proxies `/api/` to `spends-backend:8080` — no CORS needed, single domain
- Backend is ClusterIP (not exposed via Ingress directly)
- Both images pushed to `localhost:30500/homelab/spends-{backend,frontend}:<sha>`

---

## Domain Model

```
Household
  └── User (many, role: ADMIN | MEMBER)
        └── BankAccount (many per user, e.g. ICICI savings)
              └── Transaction (many per account)
                    └── Category (assigned, auto or manual)

Category        (12 system categories, seeded at startup)
CategoryRule    (UPI handle / keyword → Category, per user, priority-ordered)
Budget          (User × Category × Month → spending limit)
```

### System Categories (seeded)
Food & Dining · Transport · Rent & Housing · Utilities · Entertainment · Health & Medical · Shopping · Family Transfers · Savings & Investments · Financial · Income · Miscellaneous

---

## Key Business Rules

1. **Registration** — first user provides `householdName` (becomes ADMIN); subsequent users provide `inviteCode` (8-char code shown to ADMIN).
2. **Import** — XLS files are parsed server-side; duplicates detected via SHA-256 hash of `(bankAccountId + date + amounts + rawRemarks)`.
3. **Auto-categorization** — on import, each transaction is matched against the user's `CategoryRule` table (regex/keyword on UPI handle + description), ordered by `priority DESC`. Falls back to "Miscellaneous".
4. **Rule training** — correcting a transaction's category can optionally create a new `CategoryRule` so future imports categorize the merchant automatically.
5. **Household view** — dashboard aggregates spending across all household members.
6. **Unusual transactions** — flagged when: single amount > configurable threshold (₹10k default), new merchant never seen before, or category spend > 150% of 3-month average.

---

## Project Structure

```
spends/
├── CLAUDE.md                          ← this file
├── .gitignore
├── .github/
│   └── workflows/ci.yml               ← build + test + deploy
├── backend/
│   ├── pom.xml                        ← Spring Boot 3.3.4, Java 21
│   ├── Dockerfile
│   └── src/main/
│       ├── java/com/omprakashgautam/homelab/spends/
│       │   ├── SpendsApplication.java
│       │   ├── config/SecurityConfig.java
│       │   ├── controller/AuthController.java
│       │   ├── dto/auth/{LoginRequest,RegisterRequest,AuthResponse}.java
│       │   ├── dto/UserDto.java
│       │   ├── exception/GlobalExceptionHandler.java
│       │   ├── model/{User,Household,BankAccount,Category,Transaction,CategoryRule,Budget,Role}.java
│       │   ├── repository/*Repository.java
│       │   ├── security/{JwtTokenProvider,JwtAuthenticationFilter,UserDetailsImpl,UserDetailsServiceImpl}.java
│       │   └── service/AuthService.java
│       └── resources/
│           ├── application.yml
│           ├── application-local.yml   ← localhost:5432 via port-forward
│           ├── application-k8s.yml     ← postgres.homelab.svc.cluster.local
│           └── db/changelog/
│               ├── db.changelog-master.xml
│               ├── 001-initial-schema.sql
│               └── 002-seed-categories.sql
├── frontend/
│   ├── package.json                   ← React 18, Vite 5, Tailwind 3
│   ├── Dockerfile
│   ├── nginx.conf                     ← proxies /api/ to spends-backend:8080
│   └── src/
│       ├── App.tsx                    ← BrowserRouter + route definitions
│       ├── api/{client.ts,auth.ts}    ← axios + JWT interceptor
│       ├── store/authStore.ts         ← Zustand, persisted to localStorage
│       ├── types/index.ts
│       ├── components/{Layout.tsx,ProtectedRoute.tsx}
│       └── pages/{LoginPage,RegisterPage,DashboardPage}.tsx
└── k8s/
    ├── backend-deployment.yaml
    ├── frontend-deployment.yaml
    ├── services.yaml                  ← both ClusterIP
    ├── ingress.yaml                   ← spends.homelab.local, TLS cert-manager
    └── configmap.yaml
```

---

## API Endpoints (implemented)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | public | Create account + household or join via invite code |
| POST | `/api/auth/login` | public | Returns JWT |
| GET | `/api/auth/me` | JWT | Returns current user profile |
| GET | `/api/bank-accounts` | JWT | List user's bank accounts |
| POST | `/api/bank-accounts` | JWT | Create a bank account |
| PUT | `/api/bank-accounts/{id}` | JWT | Update a bank account |
| DELETE | `/api/bank-accounts/{id}` | JWT | Delete a bank account |
| POST | `/api/import/icici` | JWT | Import ICICI XLS/XLSX files (multipart, field: `files`) |
| GET | `/api/categories` | JWT | List all categories |
| GET | `/api/transactions` | JWT | Paginated list (search, categoryId, accountId, type, dateFrom, dateTo, sortBy, sortDir, page, size) |
| PATCH | `/api/transactions/{id}/category` | JWT | Update category; optionally create CategoryRule |
| PATCH | `/api/transactions/{id}/reviewed` | JWT | Toggle reviewed flag |

---

## Environment Variables

### Backend
| Variable | Where set | Description |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | k8s ConfigMap | `k8s` in cluster, `local` for dev |
| `DB_PASSWORD` | k8s Secret `postgres-secret` | PostgreSQL password |
| `APP_JWT_SECRET` | k8s Secret `spends-secret` | Base64-encoded ≥256-bit key |

### Frontend
None — API calls go to same-origin `/api/` and nginx proxies to backend.

---

## Running Locally (dev)

One-command launcher (recommended):

```powershell
.\dev-start.ps1          # starts everything
.\dev-start.ps1 -Stop    # kills all dev processes
```

The script: checks prereqs, retrieves DB password from k8s secret, generates/loads a JWT secret
(stored in `.dev-secrets`, gitignored), port-forwards PostgreSQL, launches backend + frontend in
separate windows, waits for health checks, and opens the browser.

Manual (if needed):
```powershell
# Terminal 1 — PostgreSQL tunnel
kubectl port-forward -n homelab svc/postgres 5432:5432

# Terminal 2 — Backend
$env:DB_PASSWORD  = "your-db-password"
$env:APP_JWT_SECRET = "<base64-256bit-secret>"
mvn -f backend/pom.xml spring-boot:run -Dspring-boot.run.profiles=local

# Terminal 3 — Frontend (proxies /api to localhost:8080)
cd frontend && npm install && npm run dev
```

> **PowerShell script encoding note:** Use plain ASCII box chars (`+`, `-`, `|`) in PS1 files.
> Unicode box-drawing characters (╔, ║, ╚) corrupt on Windows and break PowerShell parsing.

---

## Deploying to Homelab

### One-time setup
```bash
# Create JWT secret on the cluster
kubectl create secret generic spends-secret \
  --from-literal=jwt-secret=$(openssl rand -base64 64) \
  -n homelab
```

```powershell
# Windows host + Docker registry setup (run as Administrator, once)
.\scripts\windows\setup-hosts.ps1
# Adds 100.76.108.123 spends.homelab.local to hosts file
# Creates ~/.docker/daemon.json with insecure registry 100.76.108.123:30500
# Status: DONE (2026-04-14)
```

### Manual deploy (before self-hosted runner is set up)
```powershell
# Build backend
mvn -f backend/pom.xml package -DskipTests
docker build -t 100.76.108.123:30500/homelab/spends-backend:1.0.0 backend/
docker push 100.76.108.123:30500/homelab/spends-backend:1.0.0

# Build frontend
cd frontend && npm run build && cd ..
docker build -t 100.76.108.123:30500/homelab/spends-frontend:1.0.0 frontend/
docker push 100.76.108.123:30500/homelab/spends-frontend:1.0.0

# Deploy
kubectl apply -f k8s/ -n homelab
```

### CI/CD (automated)
GitHub Actions runs on every push to `main`:
- GitHub-hosted runners: backend tests + frontend build
- Self-hosted runner (homelab server): build images → push to registry → `kubectl set image`

To register the self-hosted runner: GitHub → repo Settings → Actions → Runners → New self-hosted runner.

---

## Build Phases

### Phase 1 — Project scaffold + Auth ✅ COMPLETE
- Spring Boot skeleton, pom.xml, application configs (local + k8s)
- Liquibase DB schema: all 7 tables + indexes
- Seed: 12 system categories
- JPA entities for all domain objects
- JWT authentication: register (create/join household), login, /me
- React frontend: Login page, Register page (create/join toggle), Dashboard stub
- Sidebar layout with nav, Zustand auth store, TanStack Query, Tailwind
- GitHub Actions CI (build/test + self-hosted deploy)
- k8s manifests: deployments, services, ingress (spends.homelab.local + TLS)

### Phase 2 — XLS Import + Auto-categorization ✅ COMPLETE
- `BankAccountController` — CRUD for bank accounts per user
- `ImportController` — multipart XLS upload (multiple files at once), returns summary
- `IciciStatementParser` — skip 12 header rows, auto-extract account number/holder name, parse data rows with Apache POI
- `MerchantExtractor` — regex-based UPI handle extraction, title-case cleanup
- `CategorizationService` — user + global rules matched by priority, falls back to Miscellaneous
- Duplicate detection via SHA-256 hash of (bankAccountId + date + withdrawal + deposit + remarks)
- Migration 003: `category_rule.user_id` made nullable, `is_global` column added
- Migration 004: 50+ default global rules seeded (Swiggy, Zomato, Ola, Uber, Netflix, Amazon, CRED, Zerodha, etc.)
- Frontend: Bank Accounts CRUD page, drag-and-drop import page with per-file summary
- Nav updated: Accounts + Import links in sidebar

### Phase 3 — Transaction List ✅ COMPLETE
- `CategoryController` — GET /api/categories
- `TransactionRepository` — extended with `JpaSpecificationExecutor` for dynamic filtering
- `TransactionService` — paginated list (search, category, account, type, date range), Specification-based filtering, column sort, category update with auto rule creation, reviewed toggle
- `TransactionController` — GET /api/transactions (25/page), PATCH .../category, PATCH .../reviewed
- Frontend: debounced search bar, type/category/account/date filters, sortable columns, inline category picker with colored badges, "create rule?" prompt after category change, reviewed checkbox, paginated footer
- `useDebounce` hook (300ms) for search input

### Phase 4 — Dashboard + Charts 🔲
- `DashboardController` — monthly summary, category breakdown, 12-month trend, top merchants
- Frontend: stat cards (spent/income/net/count), donut chart, bar chart, line chart (balance)

### Phase 5 — Budget Tracking 🔲
- `BudgetController` — CRUD for monthly budgets per category
- Frontend: budget management page, progress bars (green/yellow/red), overspend alerts

### Phase 6 — Household View 🔲
- Aggregate spending across all household members
- Per-member breakdown charts

### Phase 7 — Unusual Transaction Detection 🔲
- Configurable large-amount threshold
- New merchant detection
- Category spike detection (>150% of 3-month average)
- "Review" panel on dashboard

### Phase 8 — Productionize 🔲
- ~~Add `spends.homelab.local` to Windows hosts file~~ ✅ done via `scripts/windows/setup-hosts.ps1`
- Self-hosted runner setup instructions
- Health checks, resource tuning
- Backup considerations for PostgreSQL data
