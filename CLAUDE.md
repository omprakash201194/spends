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
│       │   ├── controller/{Auth,BankAccount,Import,Category,Transaction,Dashboard,Budget,Household,Alert,UserSettings,Insight}Controller.java
│       │   ├── dto/{auth/*,BudgetDto,HouseholdDto,AlertDto,UserSettingsDto,InsightDto}.java
│       │   ├── exception/GlobalExceptionHandler.java
│       │   ├── model/{User,Household,BankAccount,Category,Transaction,CategoryRule,Budget,Role}.java
│       │   ├── repository/*Repository.java
│       │   ├── security/{JwtTokenProvider,JwtAuthenticationFilter,UserDetailsImpl,UserDetailsServiceImpl}.java
│       │   └── service/{Auth,Budget,Household,Alert,Insight,Dashboard,Categorization,Import}Service.java
│       └── resources/
│           ├── application.yml
│           ├── application-local.yml   ← localhost:5432 via port-forward
│           ├── application-k8s.yml     ← postgres.homelab.svc.cluster.local
│           └── db/changelog/
│               ├── db.changelog-master.xml
│               ├── 001-initial-schema.sql
│               ├── 002-seed-categories.sql
│               ├── 003-category-rule-global.sql
│               ├── 004-global-rules-seed.sql
│               └── 005-user-claude-api-key.sql
├── frontend/
│   ├── package.json                   ← React 18, Vite 5, Tailwind 3
│   ├── Dockerfile
│   ├── nginx.conf                     ← /api/ proxy; /assets/ 1yr immutable cache; index.html no-store
│   └── src/
│       ├── App.tsx                    ← BrowserRouter + route definitions
│       ├── api/{client,auth,budget,household,alerts,settings,insights,dashboard}.ts
│       ├── store/authStore.ts         ← Zustand, persisted to localStorage
│       ├── components/{Layout,InsightCard,ProtectedRoute}.tsx
│       └── pages/{Login,Register,Dashboard,BankAccounts,Import,Transaction,Budget,Household,Settings}Page.tsx
└── k8s/
    ├── backend-deployment.yaml        ← terminationGracePeriodSeconds: 30
    ├── frontend-deployment.yaml
    ├── services.yaml                  ← both ClusterIP
    ├── ingress.yaml                   ← spends.homelab.local, TLS cert-manager
    ├── configmap.yaml                 ← JAVA_TOOL_OPTIONS container-aware JVM
    └── postgres-backup.yaml           ← nightly CronJob 2am, 7-day rotation, PVC 2Gi
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
| GET | `/api/dashboard/summary` | JWT | Monthly stats, category breakdown, 12-month trend, top merchants |
| GET | `/api/budgets` | JWT | All categories with limit + spent for anchor month |
| POST | `/api/budgets` | JWT | Set/update budget limit for a category+month |
| DELETE | `/api/budgets/{id}` | JWT | Remove a budget limit |
| GET | `/api/household` | JWT | Household summary: name, invite code, per-member stats for anchor month |
| GET | `/api/alerts` | JWT | Unusual transaction alerts for anchor month |
| GET | `/api/settings/api-key` | JWT | Returns `{ hasApiKey: boolean }` — never returns the actual key |
| PUT | `/api/settings/api-key` | JWT | Save/update Anthropic API key for the current user |
| DELETE | `/api/settings/api-key` | JWT | Remove stored API key |
| POST | `/api/insights/{type}` | JWT | Generate AI insight (type: DASHBOARD, BUDGET, TRANSACTIONS); uses user's stored Anthropic key |

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

### Phase 4 — Dashboard + Charts ✅ COMPLETE
- `DashboardController` — GET /api/dashboard/summary (single call returns everything)
- `DashboardService` — resolves anchor month to most recent month with data (not current calendar month, handles historical imports)
- Aggregate JPQL queries: sumWithdrawals, sumDeposits, countInPeriod, categoryBreakdown, monthlyTrend (TO_CHAR), topMerchants (LIMIT 8), latestTransactionDate
- Frontend: stat cards (spent/income/net/count with K/L abbreviation), Recharts bar chart (12-month debit+credit grouped), Recharts donut pie (category breakdown with category colors), top merchants with proportional progress bars, loading skeleton, empty state

### Phase 5 — Budget Tracking ✅ COMPLETE
- `BudgetDto` — `SetRequest` (categoryId, year, month, limit) · `CategoryBudget` (budgetId, categoryId, name, color, limit, spent, percentage) · `MonthSummary` (month, **year**, **monthNumber**, categories[]) — year+monthNumber included so frontend never parses the display string
- `BudgetService` — resolves anchor month via `latestTransactionDate`, merges category breakdown (spent) + existing budget limits, sorts active categories first, computes percentage with `HALF_UP` rounding
- `BudgetController` — GET `/api/budgets` (MonthSummary), POST `/api/budgets` (upsert), DELETE `/api/budgets/{id}`
- `frontend/src/api/budget.ts` — `getBudgets`, `setBudget`, `deleteBudget`
- `frontend/src/pages/BudgetPage.tsx` — 3-column card grid; inline limit input (click "Set limit" or pencil); progress bar green <80% / amber 80-100% / red ≥100%; over-budget badge; delete removes limit only
- **Responsive layout** — `Layout.tsx` rewired: sidebar is a slide-in hamburger drawer on mobile (`md:` breakpoint collapses it), static on desktop; mobile top bar shows logo + hamburger; nav links close the drawer on tap; all pages use `p-4 sm:p-6/8` responsive padding; unrouted nav items (Household, Settings) removed to prevent catch-all redirects

### Phase 6 — Household View ✅ COMPLETE
- `TransactionRepository.latestTransactionDateForHousehold()` — MAX(valueDate) across all members
- `HouseholdDto` — `MemberStat` (userId, displayName, role, spent, income, count, topCategory/color) · `Summary` (householdId, name, inviteCode, month, totalSpent, totalIncome, members[])
- `HouseholdService` — resolves anchor month household-wide, loops members calling existing per-user aggregate queries, sorts ADMIN first
- `HouseholdController` — GET `/api/household`
- `frontend/src/api/household.ts` — `getHouseholdSummary`
- `frontend/src/pages/HouseholdPage.tsx` — household header with copyable invite code chip; 3 aggregate stat cards (spent/income/net); per-member cards with avatar, role badge, top-category pill, share-of-household progress bar; solo-member empty state with prominent invite code

### Phase 7 — Unusual Transaction Detection ✅ COMPLETE
- Three alert types: `LARGE_TRANSACTION` (single debit > ₹10k), `NEW_MERCHANT` (merchant with no history in prior 6 months), `CATEGORY_SPIKE` (>1.5× 3-month rolling average, min avg ₹500)
- Three new `TransactionRepository` queries: `findLargeTransactions`, `findNewMerchantsWithSpend`, `categorySpendByMonth`
- `AlertDto` — `Alert` (type, title, message, amount) · `AlertSummary` (month, alerts[])
- `AlertService` — runs all three checks against anchor month, sorts by amount desc
- `AlertController` — GET `/api/alerts`
- `frontend/src/api/alerts.ts` — `getAlerts`
- `DashboardPage` — collapsible amber alerts panel between stat cards and charts; hidden when no alerts; each row shows type icon, title, detail message, and amount

### Phase 8 — Productionize ✅ COMPLETE
- ~~Add `spends.homelab.local` to Windows hosts file~~ ✅ done via `scripts/windows/setup-hosts.ps1`
- **Self-hosted runner** — `scripts/linux/runner-setup.sh` downloads the runner, registers it, installs as systemd service; run as the homelab user with a token from repo Settings → Actions → Runners
- **PostgreSQL backup** — `k8s/postgres-backup.yaml`: PVC (2Gi) + nightly CronJob at 2am; `pg_dump | gzip` → `/backup/spends-YYYYMMDD-HHMMSS.sql.gz`; auto-rotates, keeps 7 most recent
- **Graceful shutdown** — `server.shutdown: graceful` + 20s drain timeout in `application.yml`; `terminationGracePeriodSeconds: 30` in backend deployment (pod waits for drain before SIGKILL)
- **JVM container tuning** — `JAVA_TOOL_OPTIONS: -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0` in ConfigMap so JVM reads cgroup limits instead of host totals
- **Frontend caching** — nginx serves `/assets/*` with `Cache-Control: immutable, max-age=31536000` (Vite content-hashes filenames); `/index.html` gets `no-store` so new deploys always fetch fresh shell

#### Restore from backup
```bash
# List available backups
kubectl exec -n homelab -it $(kubectl get pod -n homelab -l app=spends-db-backup -o name | head -1) -- ls -lh /backup/

# Restore (adjust filename)
kubectl run restore --rm -it --image=postgres:16-alpine -n homelab \
  --env="PGPASSWORD=$(kubectl get secret postgres-secret -n homelab -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)" \
  -- /bin/sh -c "gunzip -c /backup/spends-20250101-020000.sql.gz | psql -h postgres.homelab.svc.cluster.local -U homelab homelab"
```

### Phase 9 — AI Insights ✅ COMPLETE
- Per-user Anthropic API key: stored in `claude_api_key` column on `app_user` (migration 005); never returned in GET responses, only `hasApiKey: boolean`
- `UserSettingsController` — GET/PUT/DELETE `/api/settings/api-key`
- `InsightService` — builds context-rich prompts from dashboard/budget/transaction aggregate data; calls Anthropic Messages API via Spring `RestClient`; model: `claude-haiku-4-5-20251001`, 600 tokens; throws `BAD_REQUEST` if no key, `BAD_GATEWAY` if API fails
- `InsightController` — POST `/api/insights/{type}` (DASHBOARD | BUDGET | TRANSACTIONS)
- `InsightCard` component — four states: idle (prompt), loading (spinner), done (bullet list + Regenerate), error (message + Settings link)
- Insight buttons on: Dashboard page, Budget page ("Get Budget Advice"), Transactions page ("Analyse My Spending")
- `SettingsPage` — password-type API key input, Save/Remove buttons, link to console.anthropic.com
