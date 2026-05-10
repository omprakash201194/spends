# SpendStack

> Self-hosted personal finance tracker for households — import bank statements, auto-categorize transactions, track budgets, and visualize your spending.

[![CI](https://github.com/omprakash201194/spends/actions/workflows/ci.yml/badge.svg)](https://github.com/omprakash201194/spends/actions/workflows/ci.yml)
![Java](https://img.shields.io/badge/Java-21-orange?logo=openjdk)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3.4-brightgreen?logo=springboot)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Overview

SpendStack is a fully self-hosted expense manager designed for households. It imports Indian bank statements (ICICI, Bank of Baroda, Kotak), deduplicates transactions, auto-categorizes them using a rule engine, and provides a rich dashboard with budgets, recurring pattern detection, savings goals, and AI-powered insights — all running on your own infrastructure with no third-party data sharing.

**Key properties:**
- All data stays on your server (PostgreSQL, no cloud sync)
- Multi-user: one household, multiple members share a view
- Statement import with duplicate detection via SHA-256 hash
- Rule-based auto-categorization with a global seed of 50+ merchant rules
- Optional AI insights via your own Anthropic API key
- Installable as a PWA on mobile

---

## Features

### Import & Transactions
- Import ICICI XLS/XLSX, Bank of Baroda CSV, and Kotak CSV statements
- Multi-file drag-and-drop upload with per-file confidence scores and review queue
- Duplicate detection — re-importing the same file is safe
- Import history with per-batch delete
- Full-text search, multi-filter (category, account, type, date range), sort
- Inline category assignment, bulk category update, reviewed flag, notes
- Transaction splits across multiple categories
- CSV export with active filters applied

### Categorization
- Hierarchical categories (system + custom, configurable depth per household)
- Priority-ordered rule engine: regex/keyword on merchant name, UPI handle
- 50+ seeded global rules (Swiggy, Zomato, Ola, Uber, Netflix, Amazon, CRED, Zerodha…)
- Correcting a category can auto-create a rule for future imports
- AI-generated rule flag so you know which rules came from the model
- Category bundles: export/import rule sets with JSON editor and optional reapply to existing transactions
- Merchant alias normalization before rule matching

### Dashboard & Analytics
- Lifetime stat cards: spent, income, net, transaction count
- Month-over-month and year-over-year delta badges
- 12-month grouped bar chart (debit + credit)
- Category donut chart, top merchants, unusual transaction alerts
- Per-account filter (single-account users see no extra UI)
- Recurring pattern detection: frequency, average amount, next expected date, missed-this-month flag
- Monthly/yearly reports with printable layout
- Net worth timeline (cumulative running sum)
- Data health audit: categorization rate, near-duplicate candidates, rule coverage

### Budgets & Goals
- Monthly budgets per category with carry-forward rollover
- Annual budgets
- Savings goals with progress bars (achieved / overdue / days-left badges)
- Budget views on trips or events (auto-tag transactions in a date range)

### Custom Dashboards
- Multiple named dashboards per user
- Widget types: PIE, BAR, LINE, STAT
- Filter by category (with full subtree expansion) or all transactions
- Period presets: 3m / 6m / 12m / 24m / All time
- Widget preview before saving, drag-to-reorder

### Household & Social
- Invite-code-based membership (admin + member roles)
- Household view: per-member spend/income breakdown, top category
- Views: TRIP / EVENT / CUSTOM — group transactions into an event with a budget
- Settlements: track shared expenses and mark them as settled

### Quality of Life
- Dark mode (persisted)
- PWA — installable on iOS and Android
- Mobile-first responsive layout with bottom navigation bar
- AI insights on Dashboard, Budget, Transactions, Recurring pages (uses your Anthropic key, cached locally with age display)
- Daily email digest for large transactions (optional)
- Structured JSON logging with per-request correlation IDs

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Spring Boot 3.3.4, Java 21, Maven |
| Frontend | React 18, TypeScript, Vite 5 |
| Styling | TailwindCSS 3 |
| State | Zustand 5 |
| Data fetching | TanStack Query v5 |
| Charts | Recharts |
| Database | PostgreSQL |
| Migrations | Liquibase |
| Auth | JWT (JJWT 0.12.6), BCrypt |
| XLS parsing | Apache POI 5.3 |
| CSV parsing | Apache Commons CSV 1.11 |
| PWA | vite-plugin-pwa + Workbox |
| Container | Docker, nginx (frontend) |
| Orchestration | Kubernetes (k3s) |
| CI/CD | GitHub Actions |

---

## Architecture

```
spends.homelab.local (HTTPS, TLS via cert-manager)
        │
        ▼
  [spends-frontend]   nginx — serves React SPA
        │              proxies /api/* → backend
        ▼
  [spends-backend]    Spring Boot — ClusterIP only
        │
        ▼
     PostgreSQL        existing cluster StatefulSet
```

The frontend and backend share a single domain. The nginx proxy handles `/api/` routing so no CORS configuration is needed. The backend is never exposed via Ingress directly.

---

## Getting Started

### Prerequisites

- Java 21
- Node 20
- PostgreSQL (local or via `kubectl port-forward`)
- Maven 3.9+

### Clone

```bash
git clone https://github.com/omprakash201194/spends.git
cd spends
```

### Run locally (Windows — recommended)

The `dev-start.ps1` script handles everything: retrieves the DB password from the cluster secret, generates a JWT secret, port-forwards PostgreSQL, and starts both servers in separate terminal windows.

```powershell
.\dev-start.ps1          # start everything
.\dev-start.ps1 -Stop    # kill all dev processes
```

### Run locally (manual)

```bash
# Terminal 1 — PostgreSQL tunnel (or point at a local instance)
kubectl port-forward -n homelab svc/postgres 5432:5432

# Terminal 2 — Backend
export DB_PASSWORD="your-db-password"
export APP_JWT_SECRET="$(openssl rand -base64 64)"
mvn -f backend/pom.xml spring-boot:run -Dspring-boot.run.profiles=local

# Terminal 3 — Frontend (proxies /api to localhost:8080)
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:8080`

### Environment variables

| Variable | Description |
|---|---|
| `DB_PASSWORD` | PostgreSQL password |
| `APP_JWT_SECRET` | Base64-encoded ≥256-bit key |
| `SPRING_PROFILES_ACTIVE` | `local` for dev, `k8s` in cluster |
| `MAIL_HOST` | SMTP host (optional, for email digest) |
| `MAIL_PORT` | SMTP port |
| `MAIL_USERNAME` | SMTP username |
| `MAIL_PASSWORD` | SMTP password |
| `NOTIFICATION_ENABLED` | `true` to enable daily digest |

---

## Deploying to Kubernetes

### One-time cluster setup

```bash
# JWT secret
kubectl create secret generic spends-secret \
  --from-literal=jwt-secret=$(openssl rand -base64 64) \
  -n homelab

# Apply manifests
kubectl apply -f k8s/ -n homelab
```

### CI/CD (automated)

Every push to `main` triggers the GitHub Actions pipeline:

1. **GitHub-hosted runners** — backend tests + frontend type-check + build
2. **Self-hosted runner** (on the homelab server) — builds Docker images, pushes to the local registry, runs `kubectl set image`

To register the self-hosted runner:

```
GitHub → repo Settings → Actions → Runners → New self-hosted runner
```

The runner setup script is at `scripts/linux/runner-setup.sh`.

### Manual deploy

```bash
# Backend
mvn -f backend/pom.xml package -DskipTests
docker build -t 100.76.108.123:30500/homelab/spends-backend:1.0.0 backend/
docker push 100.76.108.123:30500/homelab/spends-backend:1.0.0

# Frontend
cd frontend && npm run build && cd ..
docker build -t 100.76.108.123:30500/homelab/spends-frontend:1.0.0 frontend/
docker push 100.76.108.123:30500/homelab/spends-frontend:1.0.0

kubectl apply -f k8s/ -n homelab
```

---

## Supported Banks

| Bank | Format | Parser |
|---|---|---|
| ICICI Bank | XLS / XLSX | `IciciStatementParser` |
| Bank of Baroda | CSV | `BobStatementParser` |
| Kotak Mahindra Bank | CSV | `KotakStatementParser` |

Adding a new bank requires writing a `StatementParser` component and two lines in `ImportService`. All parsers return a shared `ParsedStatement` record.

---

## Database Migrations

Migrations live in `backend/src/main/resources/db/changelog/changes/` and are applied automatically on startup via Liquibase. The master changelog is `db.changelog-master.xml`.

| Migration | Description |
|---|---|
| 001 | Initial schema (all tables + indexes) |
| 002 | Seed 12 system categories |
| 003–004 | Global category rules + 50+ merchant seeds |
| 005 | Per-user Anthropic API key column |
| 006 | Custom categories (household-scoped) |
| 007 | Views schema (spend_view, join tables) |
| 008 | Import batch tracking |
| 009 | Category FK set-null on delete |
| 010 | Savings goals |
| 011–017 | Notes, budget rollover, annual budgets, merchant aliases, splits, settlements, notification email |
| 018 | Performance indexes |
| 019 | Household max category depth |
| 020 | AI-generated rule flag |
| 021–022 | Custom dashboard widgets + multiple dashboards |
| 023–025 | Widget account/date range filter, dashboard filters, category bundle fields |

---

## API Reference

All endpoints require a `Bearer` JWT token except `/api/auth/register` and `/api/auth/login`.

<details>
<summary>Auth</summary>

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account + household, or join via invite code |
| POST | `/api/auth/login` | Returns JWT |
| GET | `/api/auth/me` | Current user profile |

</details>

<details>
<summary>Bank Accounts</summary>

| Method | Path | Description |
|---|---|---|
| GET | `/api/bank-accounts` | List user's accounts |
| POST | `/api/bank-accounts` | Create account |
| PUT | `/api/bank-accounts/{id}` | Update account |
| DELETE | `/api/bank-accounts/{id}` | Delete account |

</details>

<details>
<summary>Import</summary>

| Method | Path | Description |
|---|---|---|
| POST | `/api/import/icici` | Import ICICI XLS files (multipart `files`) |
| POST | `/api/import/bob` | Import Bank of Baroda CSV files |
| POST | `/api/import/kotak` | Import Kotak CSV files |
| GET | `/api/import/history` | List all import batches |
| DELETE | `/api/import/batches/{batchId}` | Delete a batch and its transactions |
| DELETE | `/api/import/all` | Delete all transactions and batches |

</details>

<details>
<summary>Transactions</summary>

| Method | Path | Description |
|---|---|---|
| GET | `/api/transactions` | Paginated list with filters |
| PATCH | `/api/transactions/{id}/category` | Update category; optionally create rule |
| PATCH | `/api/transactions/{id}/reviewed` | Toggle reviewed flag |
| PATCH | `/api/transactions/{id}/note` | Set or update note |
| PATCH | `/api/transactions/bulk-category` | Bulk update category for list of IDs |
| GET | `/api/transactions/{id}/splits` | List splits |
| PUT | `/api/transactions/{id}/splits` | Replace all splits |
| GET | `/api/export/transactions` | CSV download with active filters |

</details>

<details>
<summary>Dashboard & Analytics</summary>

| Method | Path | Description |
|---|---|---|
| GET | `/api/dashboard/summary` | Stats, charts, alerts, comparisons |
| GET | `/api/recurring` | Recurring patterns (`?months=`) |
| GET | `/api/alerts` | Unusual transaction alerts |
| GET | `/api/net-worth` | Monthly net-worth timeline |
| GET | `/api/reports/available-years` | Years with transaction data |
| GET | `/api/reports/monthly-summary` | 12-month table for a year |
| GET | `/api/data-health` | Categorization health + near-duplicates |

</details>

<details>
<summary>Categories & Rules</summary>

| Method | Path | Description |
|---|---|---|
| GET | `/api/categories` | All categories (system + household) |
| POST | `/api/categories` | Create custom category |
| PUT | `/api/categories/{id}` | Update custom category |
| DELETE | `/api/categories/{id}` | Delete custom category |
| GET | `/api/category-rules` | User's categorization rules |
| POST | `/api/category-rules` | Create rule |
| PUT | `/api/category-rules/{id}` | Update rule |
| DELETE | `/api/category-rules/{id}` | Delete rule |
| GET | `/api/category-bundles` | List shareable bundles |
| POST | `/api/category-bundles/export` | Export categories + rules as bundle |
| POST | `/api/category-bundles/import` | Import a bundle |
| POST | `/api/category-bundles/reapply` | Reapply rules to existing transactions |
| GET | `/api/merchant-aliases` | User's merchant aliases |
| POST | `/api/merchant-aliases` | Create or update alias (upsert) |
| DELETE | `/api/merchant-aliases/{id}` | Delete alias |

</details>

<details>
<summary>Budgets & Goals</summary>

| Method | Path | Description |
|---|---|---|
| GET | `/api/budgets` | Categories with limit + spent for anchor month |
| POST | `/api/budgets` | Set budget limit |
| DELETE | `/api/budgets/{id}` | Remove budget limit |
| GET | `/api/annual-budgets` | Annual budgets for `?year=` |
| PUT | `/api/annual-budgets` | Create or update annual budget |
| DELETE | `/api/annual-budgets/{id}` | Delete annual budget |
| GET | `/api/goals` | Savings goals with computed progress |
| POST | `/api/goals` | Create goal |
| DELETE | `/api/goals/{id}` | Delete goal |

</details>

<details>
<summary>Household & Social</summary>

| Method | Path | Description |
|---|---|---|
| GET | `/api/household` | Household summary with per-member stats |
| GET | `/api/views` | List household views |
| POST | `/api/views` | Create view (auto-tags transactions in date range) |
| GET | `/api/views/{id}` | View detail |
| PUT | `/api/views/{id}` | Update view + category budgets |
| DELETE | `/api/views/{id}` | Delete view |
| GET | `/api/views/{id}/transactions` | Paginated transactions in view |
| GET | `/api/views/{id}/summary` | Total + category + member breakdown |
| POST | `/api/views/{id}/transactions` | Add transactions to view |
| DELETE | `/api/views/{id}/transactions/{txId}` | Remove transaction from view |
| GET | `/api/settlements` | List settlements |
| POST | `/api/settlements` | Create settlement with line items |
| PATCH | `/api/settlements/{id}/settle` | Mark as settled |
| DELETE | `/api/settlements/{id}` | Delete settlement |

</details>

<details>
<summary>Custom Dashboards & Widgets</summary>

| Method | Path | Description |
|---|---|---|
| GET | `/api/dashboards` | List user's dashboards |
| POST | `/api/dashboards` | Create dashboard |
| PATCH | `/api/dashboards/{id}` | Rename dashboard |
| DELETE | `/api/dashboards/{id}` | Delete dashboard |
| GET | `/api/dashboards/{id}/widgets` | List widgets in dashboard |
| POST | `/api/dashboards/{id}/widgets` | Add widget to dashboard |
| PUT | `/api/widgets/{id}` | Update widget |
| DELETE | `/api/widgets/{id}` | Delete widget |
| POST | `/api/widgets/{id}/move` | Reorder widget |
| GET | `/api/widgets/{id}/data` | Fetch chart data for widget |
| POST | `/api/widgets/preview` | Preview widget data without saving |

</details>

<details>
<summary>Settings</summary>

| Method | Path | Description |
|---|---|---|
| GET | `/api/settings/api-key` | Returns `{ hasApiKey: boolean }` |
| PUT | `/api/settings/api-key` | Save Anthropic API key |
| DELETE | `/api/settings/api-key` | Remove API key |
| GET | `/api/settings/preferences` | Returns `{ maxCategoryDepth }` |
| PUT | `/api/settings/preferences` | Update preferences |
| PUT | `/api/settings/notification-email` | Save or remove digest email |
| POST | `/api/insights/{type}` | Generate AI insight (DASHBOARD \| BUDGET \| TRANSACTIONS \| RECURRING) |
| DELETE | `/api/danger-zone/transactions` | Delete all user transactions |
| DELETE | `/api/danger-zone/rules` | Delete all user rules |
| DELETE | `/api/danger-zone/budgets` | Delete all user budgets |
| DELETE | `/api/danger-zone/views` | Delete all household views |
| DELETE | `/api/danger-zone/custom-categories` | Delete all household custom categories |

</details>

---

## Project Structure

```
spends/
├── backend/                    Spring Boot application
│   ├── Dockerfile
│   ├── pom.xml
│   └── src/main/
│       ├── java/.../spends/
│       │   ├── config/         SecurityConfig
│       │   ├── controller/     REST endpoints (one file per domain)
│       │   ├── dto/            Request/response records
│       │   ├── exception/      GlobalExceptionHandler
│       │   ├── filter/         RequestCorrelationFilter (MDC requestId)
│       │   ├── model/          JPA entities
│       │   ├── repository/     Spring Data + custom JPQL queries
│       │   ├── security/       JWT provider + filter + UserDetails
│       │   └── service/        Business logic + statement parsers
│       └── resources/
│           ├── application.yml
│           ├── application-local.yml   dev (localhost:5432)
│           ├── application-k8s.yml     cluster (postgres.homelab.svc)
│           └── db/changelog/           Liquibase migrations
├── frontend/                   React SPA
│   ├── Dockerfile
│   ├── nginx.conf              /api/ proxy + asset caching
│   └── src/
│       ├── api/                Axios clients (one file per domain)
│       ├── components/         Layout, WidgetForm, WidgetRenderer, InsightCard, BottomNav…
│       ├── hooks/              useDebounce, useInstallPrompt
│       ├── pages/              One file per route
│       ├── store/              Zustand (auth, nav, theme)
│       └── App.tsx             BrowserRouter + routes
├── k8s/                        Kubernetes manifests
│   ├── backend-deployment.yaml
│   ├── frontend-deployment.yaml
│   ├── services.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml          JVM tuning env vars
│   └── postgres-backup.yaml    Nightly CronJob, 7-day retention
├── scripts/
│   ├── linux/runner-setup.sh   Register GitHub Actions self-hosted runner
│   └── windows/setup-hosts.ps1 Add hosts + insecure registry on Windows dev machine
├── .github/workflows/ci.yml    Build + test + deploy pipeline
└── dev-start.ps1               One-command local dev launcher (Windows)
```

---

## Backup & Restore

Nightly backups run at 2am via a Kubernetes CronJob. Backups are stored in a 2Gi PVC and rotated — only the 7 most recent are kept.

```bash
# List backups
kubectl exec -n homelab \
  $(kubectl get pod -n homelab -l app=spends-db-backup -o name | head -1) \
  -- ls -lh /backup/

# Restore
kubectl run restore --rm -it --image=postgres:16-alpine -n homelab \
  --env="PGPASSWORD=$(kubectl get secret postgres-secret -n homelab \
    -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)" \
  -- /bin/sh -c "gunzip -c /backup/spends-YYYYMMDD-HHMMSS.sql.gz \
    | psql -h postgres.homelab.svc.cluster.local -U homelab homelab"
```

---

## AI Insights

SpendStack can generate spending insights using the Claude API. Each user stores their own Anthropic API key — the key is never returned via API, only a `hasApiKey: boolean` flag is exposed.

1. Get an API key at [console.anthropic.com](https://console.anthropic.com)
2. Go to **Settings → API Key** in the app and save it
3. Use the "Get Insights" button on Dashboard, Budget, Transactions, or Recurring pages

Insights use `claude-haiku-4-5-20251001` with a 600-token limit and are cached locally with a timestamp so you can see when they were last generated.

---

## Contributing

This is a personal homelab project, but contributions are welcome.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and add tests where applicable
4. Ensure the backend tests pass: `mvn -f backend/pom.xml test`
5. Ensure the frontend builds: `npm run build --prefix frontend`
6. Open a pull request against `main`

### Adding a new bank parser

1. Create `src/main/java/.../service/YourBankStatementParser.java` — implement parsing logic, return `ParsedStatement`
2. Add `importYourBankFiles(...)` to `ImportService` (2 lines — delegate to `importFilesWith`)
3. Add `POST /api/import/your-bank` to `ImportController`
4. Add the bank option to the frontend `ImportPage` dropdown

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Acknowledgements

Built on top of a self-hosted k3s homelab. Inspired by the lack of privacy-respecting alternatives to cloud expense trackers.
