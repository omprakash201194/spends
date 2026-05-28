# SpendStack — Production Readiness Plan

Tracking the work needed to take SpendStack from a homelab tool to a multi-user, public-facing financial app.

**Context:** Financial data (transactions, bank account numbers, AI API keys). Bar is higher than a personal homelab tool.

## Status legend
- 🔴 Critical — blocks production
- 🟡 High — needed before real users
- 🟢 Medium — quality of life, nice-to-have

## Recommended order
If going public in the next month, tackle in this order:
1. #1 Encrypt API keys
2. #3 Backup restore drill
3. #9 Sentry for backend + frontend
4. #10 Micrometer + Grafana dashboard
5. #5 HSTS + secure-cookie config
6. #2 Tighten password policy
7. #15 PR-based CI with preview deploys

---

## 🔴 Critical

### [ ] 1. Encrypt Anthropic API keys at rest
**Risk:** `user.claude_api_key` is plaintext `VARCHAR`. If the DB is leaked or `pg_dump` falls into wrong hands, every user's Anthropic key leaks — they get billed, you get sued.

**What to do:**
- Add a `APP_ENCRYPTION_KEY` env var (32-byte base64, separate from JWT secret)
- Create `CryptoService` with `encrypt(plaintext)` and `decrypt(ciphertext)` using AES-256-GCM
- Encrypt on `UserSettingsController.saveApiKey()`, decrypt in `InsightService` just before the HTTP call
- Liquibase migration: rename column to `claude_api_key_encrypted`, add `encryption_version SMALLINT`
- One-time backfill task (or accept that existing keys need re-entry)

**Acceptance:** Reading the DB directly shows ciphertext, not the actual key. Insight calls still work end-to-end.

**Effort:** ~4 hours · **Files:** `User.java`, `UserSettingsController.java`, `InsightService.java`, new `CryptoService.java`, new migration 031

---

### [ ] 2. Enforce password complexity
**Risk:** Current `@Size(min = 8)` accepts `password` or `12345678`. For a financial app this is too weak.

**What to do:**
- Add `@Pattern(regexp = "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d).{10,}$", message = "...")` to `RegisterRequest.password` and `ResetPasswordRequest.newPassword`
- Frontend: live strength meter in Register and Reset Password forms
- Reject the 10k most common passwords (or use HaveIBeenPwned k-anonymity API)

**Acceptance:** `password123` is rejected with a clear message. `MySecure!Pass1` is accepted.

**Effort:** ~2 hours · **Files:** `RegisterRequest.java`, `ResetPasswordRequest.java`, `RegisterPage.tsx`, `ResetPasswordPage.tsx`

---

### [ ] 3. Backup restore drill (and document it)
**Risk:** `postgres-backup.yaml` runs nightly but **no one has ever restored from it**. A backup you've never restored from is hope, not insurance.

**What to do:**
- Spin up a fresh Postgres pod in a `restore-test` namespace
- `gunzip` a recent backup and `psql` restore into it
- Run the SpendStack backend against it and verify the app works
- Document the procedure in `docs/RESTORE.md` with exact commands
- Add a quarterly reminder via `/schedule` or k8s CronJob to repeat

**Acceptance:** A new dev can restore from backup in under 30 minutes by following the doc.

**Effort:** ~3 hours · **Files:** new `docs/RESTORE.md`

---

### [ ] 4. JWT secret rotation procedure
**Risk:** `APP_JWT_SECRET` is set once at deploy. If it leaks, every issued token is forever-valid. Current HS256 setup can't dual-validate during rotation.

**What to do:**
- Refactor `JwtTokenProvider` to accept a list of secrets and validate against any of them
- Add `APP_JWT_SECRET_PREV` env var (the previous one, kept for 7 days)
- Document rotation: deploy with both → wait for token TTL (24h) → drop the old one
- Alternative: switch to RS256 with a key set served via JWKS endpoint (heavier but standard)

**Acceptance:** Rotating the JWT secret doesn't log out all users mid-session.

**Effort:** ~6 hours · **Files:** `JwtTokenProvider.java`, `JwtAuthenticationFilter.java`

---

### [ ] 5. HSTS + secure-cookie + force HTTPS in Spring Security
**Risk:** Backend doesn't enforce HTTPS. Anyone on the internal cluster network could hit the backend over HTTP and bypass TLS entirely.

**What to do:**
- In `SecurityConfig.filterChain`:
  ```java
  .headers(h -> h
      .httpStrictTransportSecurity(hsts -> hsts.maxAgeInSeconds(31536000).includeSubDomains(true))
      .frameOptions(f -> f.deny())
      .contentTypeOptions(o -> {}))
  .requiresChannel(c -> c.anyRequest().requiresSecure())
  ```
- Configure `server.servlet.session.cookie.secure=true` and `same-site=lax`
- Set `server.forward-headers-strategy=framework` (already done) so the `requiresSecure` check honours `X-Forwarded-Proto`

**Acceptance:** `curl -I http://backend/api/auth/login` returns 302 to HTTPS. Headers include `Strict-Transport-Security`.

**Effort:** ~1 hour · **Files:** `SecurityConfig.java`, `application.yml`

---

### [ ] 6. Validate string input lengths on all user-controllable params
**Risk:** Endpoints accept unbounded strings. A 10MB `search` query string could pin the DB. JPQL parameterisation prevents SQL injection but not DoS.

**What to do:**
- Add `@Size(max = N)` to every `@RequestParam String` and DTO field:
  - `search` → 200 chars
  - `tag` → 100 chars
  - `note` → 1000 chars
  - `name` (categories, goals, etc.) → 100 chars
  - `pattern` (rules) → 255 chars
- Add `@Valid` on the controller methods
- Frontend: enforce same max in form `<input maxLength>`

**Acceptance:** Posting a 100KB string returns 400 with a clear validation error instead of timing out the DB.

**Effort:** ~3 hours · **Files:** controllers and DTOs across the backend

---

## 🟡 High

### [ ] 7. Multi-replica + HPA + PodDisruptionBudget
**Risk:** `replicas: 1` means every deploy = downtime. A pod crash = downtime until the new one starts (which can be 60s with our startup probe).

**What to do:**
- Bump `replicas: 2` on backend and frontend deployments
- Add HorizontalPodAutoscaler targeting 70% CPU
- Add PodDisruptionBudget with `minAvailable: 1`
- **Prereq:** k3s currently runs on a single node. Real multi-replica needs a second worker node. For now, this still helps with rolling deploys.

**Acceptance:** `kubectl rollout restart deployment/spends-backend` causes zero failed requests.

**Effort:** ~2 hours · **Files:** `k8s/backend-deployment.yaml`, `k8s/frontend-deployment.yaml`, new `k8s/hpa.yaml`, new `k8s/pdb.yaml`

---

### [ ] 8. PostgreSQL high availability / PITR
**Risk:** Single Postgres pod, single PVC, single node. Disk failure = total data loss back to last `pg_dump` (worst case 24h).

**What to do (in order of cost):**
- **Cheap:** Use `pgbackrest` for continuous WAL archiving to S3-compatible storage (Backblaze B2 ~$6/TB/month). Enables point-in-time recovery to any second in the last 7 days
- **Medium:** Set up `repmgr` or `Patroni` with a streaming replica on a second node
- **Production-grade:** Migrate to `CloudNativePG` operator (handles backups, replicas, failover automatically)

**Acceptance:** Can restore to any timestamp in the last 7 days. Pod failure on the primary triggers automatic failover.

**Effort:** ~1 day (pgbackrest) → 3 days (CloudNativePG migration)

---

### [ ] 9. Error tracking (Sentry)
**Risk:** Backend errors → logs only. Frontend errors → console → nothing. Bugs are discovered when users complain.

**What to do:**
- Sign up for Sentry (free tier = 5k errors/month, plenty)
- Backend: add `sentry-spring-boot-starter`, configure `sentry.dsn` env var
- Frontend: `npm install @sentry/react`, init in `main.tsx` with `Sentry.init({ dsn, integrations: [...] })`
- Wrap React root in `<Sentry.ErrorBoundary>`
- Capture user ID context (not email — PII)
- Set up alerts: anything > 10 errors/hour pings you on email/Slack

**Acceptance:** Throwing a test exception shows up in Sentry within 30s with full stack trace.

**Effort:** ~3 hours · **Files:** `pom.xml`, `application.yml`, `main.tsx`, `App.tsx`

---

### [ ] 10. Application metrics + Grafana dashboard
**Risk:** Loki captures logs (Phase 21) but no metrics. Don't know what "slow" looks like. No way to detect a slow query before users notice.

**What to do:**
- Expose `prometheus` in `management.endpoints.web.exposure.include`
- Add `micrometer-registry-prometheus` to `pom.xml`
- Add metric tags: `@Timed` on key controllers (transactions list, import, dashboard summary)
- Custom metric: `spends.import.duration` with `bank` tag
- Custom metric: `spends.insights.tokens_used` for AI calls
- Build a Grafana dashboard: request rate, p50/p95/p99 latency, error rate, JVM heap, DB connection pool saturation
- Alerts on: error rate > 1%, p95 latency > 2s, heap usage > 90%

**Acceptance:** Dashboard shows live traffic. Triggering a slow query shows up in p95 within a minute.

**Effort:** ~5 hours · **Files:** `pom.xml`, `application.yml`, controllers, new Grafana dashboard JSON

---

### [ ] 11. Integration test suite with Testcontainers
**Risk:** 25 of 28 controllers have zero tests. Service tests use mocks → cascade-delete bugs, migration bugs, concurrency bugs slip through.

**What to do:**
- Add `org.testcontainers:postgresql` to test scope
- Base class `IntegrationTest` that spins up a real Postgres via Testcontainers and runs Liquibase
- `@WebMvcTest` integration tests for top 10 controllers: Auth, BankAccount, Transaction, Import, Budget, Category, View, Settlement, Goal, Widget
- Each: happy path + 401 + 403 + 404 + validation error
- Goal: 70% backend coverage (currently ~40%)

**Acceptance:** `mvn verify` runs both unit and integration tests. Coverage report shows 70%+ on services and controllers.

**Effort:** ~2 days · **Files:** new tests across backend

---

### [ ] 12. Per-user rate limiting (not just per-IP)
**Risk:** Current `RateLimitFilter` limits by IP. A malicious user with rotating IPs could DOS, or one user behind a NAT could exhaust shared limits for others.

**What to do:**
- Extract user ID from JWT in the filter (before authentication)
- Bucket key: `{userId}:{path}` instead of `{ip}:{path}`
- Per-user limits:
  - Transaction list: 60 req/min
  - AI insights: 20 req/hour
  - Bulk delete: 5 req/min
- Keep IP-based limits for public endpoints (login, register, forgot-password)

**Acceptance:** Hammering `/api/transactions` while authenticated returns 429 after 60 requests in a minute, regardless of source IP.

**Effort:** ~2 hours · **Files:** `RateLimitFilter.java`

---

### [ ] 13. Audit log retention + structured query
**Risk:** `log.warn("AUDIT: ...")` writes to stdout → Loki. Loki has no retention configured. A year from now you can't prove who deleted what.

**What to do:**
- Configure Loki retention to keep audit-tagged logs for 2 years (`retention_period: 17520h` for that stream)
- Create a structured audit table in Postgres: `audit_event(id, user_id, action, entity_type, entity_id, metadata JSONB, timestamp)`
- New `AuditService` that writes both to log (for ops) and DB (for compliance queries)
- Migrate existing `log.warn("AUDIT: ...")` call sites to use `AuditService`
- Compliance endpoint: `GET /api/audit/me` returns the user's own audit trail

**Acceptance:** Can answer "who deleted view X" via a SQL query for the last 2 years.

**Effort:** ~6 hours · **Files:** new `AuditService.java`, new migration, update 8 call sites

---

### [ ] 14. Frontend tests in CI
**Risk:** Zero frontend tests. TypeScript compiles but a logic bug ships.

**What to do:**
- Add Vitest + React Testing Library
- Start with the highest-leverage tests:
  - `authStore` (login → state, logout → state, persistence)
  - `personaStore` (onboarding flow)
  - `useDebounce` hook
  - `TransactionPage` filter URL serialization
  - `BudgetPage` percentage calculation
- Add `npm test` step to CI workflow
- Target: 30% coverage as a starting point

**Acceptance:** `npm test` runs and reports coverage. CI fails on test failure.

**Effort:** ~1 day · **Files:** new `vitest.config.ts`, test files, `ci.yml`

---

## 🟢 Medium

### [ ] 15. Staging environment + PR preview deploys
**Risk:** Every commit on `main` is live for users. No way to validate a migration or feature against real data shape.

**What to do:**
- Create `homelab-staging` namespace mirroring `homelab`
- Separate Postgres pod with a sanitised copy of prod data (refresh weekly)
- GitHub Actions: on PR open, build images tagged `pr-{N}`, deploy to `staging-pr-{N}` namespace, comment the PR with the preview URL
- On PR close, tear down

**Acceptance:** Opening a PR results in a comment with a working URL within 10 minutes.

**Effort:** ~1 day · **Files:** `.github/workflows/preview.yml`, k8s overlay or kustomize

---

### [ ] 16. Feature flags
**Risk:** No way to roll out a feature to 10% of users, or kill-switch a broken feature without a deploy.

**What to do:**
- Add `feature_flag` table: `(name VARCHAR PK, enabled BOOLEAN, percentage INT, created_at)`
- New `FeatureFlagService.isEnabled(flagName, userId)` — checks flag, deterministic bucketing via `userId.hashCode() % 100 < percentage`
- Admin UI to toggle flags
- Frontend: `useFeatureFlag(name)` hook
- Use it for the next feature

**Acceptance:** Can enable a feature for 10% of users without deploying.

**Effort:** ~6 hours

---

### [ ] 17. OpenAPI / Swagger docs
**Risk:** 28 controllers have no machine-readable API doc. Hard to integrate from outside.

**What to do:**
- Add `springdoc-openapi-starter-webmvc-ui` to `pom.xml`
- Add `@Operation(summary = "...")` and `@ApiResponse` annotations to controllers (start with auth + transactions)
- Expose at `/api/docs`, protect behind admin role
- Generate TypeScript client from the OpenAPI spec → frontend uses generated types instead of hand-rolled

**Acceptance:** `https://spends.onelifestack.com/api/docs` shows interactive Swagger UI for every endpoint.

**Effort:** ~4 hours

---

### [ ] 18. Frontend bundle-size budget
**Risk:** A 5MB lib could be added without anyone noticing. Pages slow down silently.

**What to do:**
- Add `rollup-plugin-visualizer` to view what's in the bundle
- Set CI budget: fail if any chunk > 500KB gzipped (current is ~280KB)
- Lazy-load heavy charts (Recharts) on routes that need them

**Acceptance:** CI fails if bundle grows > 500KB. Custom Dashboard page lazy-loads charts.

**Effort:** ~3 hours · **Files:** `vite.config.ts`, `ci.yml`, lazy-load wrappers

---

### [ ] 19. GDPR data export + right to be forgotten
**Risk:** EU users have a legal right to download all their data and delete it. Currently only CSV export exists. Deleting an account leaves audit logs and orphaned data.

**What to do:**
- `GET /api/me/export` returns a single ZIP with: transactions CSV, categories CSV, rules CSV, budgets CSV, goals CSV, settings JSON
- `DELETE /api/me` cascades: nuke transactions, accounts, rules, budgets, views, goals, settlements, audit logs older than legal retention, user row, household if last member
- 7-day grace period: account marked `deleted_at`, hidden from login, hard-deleted by a scheduled job
- Settings page button: "Download my data" and "Delete my account"

**Acceptance:** Downloaded ZIP contains every record the DB has about the user. After deletion, no record references the user ID.

**Effort:** ~1 day

---

### [ ] 20. Privacy policy + terms of service
**Risk:** Required by law in most jurisdictions if you have users. Especially financial data.

**What to do:**
- Use a template (GDPR-compliant): clearly state what's collected, why, how long, third parties (Anthropic, Cloudflare, Google OAuth, SMTP)
- Link from Register and Login pages
- Cookie consent banner only if you add analytics that uses non-essential cookies (currently only auth cookies, which are essential)

**Acceptance:** Privacy policy and ToS pages live at `/privacy` and `/terms`. Registration requires checkbox acknowledgement.

**Effort:** ~3 hours (mostly writing)

---

### [ ] 21. robots.txt + sitemap.xml
**Risk:** Search engines could index login page (low value) or worse — cached URLs with leaked tokens.

**What to do:**
- `public/robots.txt`:
  ```
  User-agent: *
  Disallow: /
  Allow: /$
  ```
- Frontend should never put tokens in URL query params (OAuth callback is the only exception — already handled)

**Acceptance:** `curl spends.onelifestack.com/robots.txt` returns the file.

**Effort:** ~10 minutes

---

### [ ] 22. Email deliverability (SPF, DKIM, DMARC)
**Risk:** Password reset emails via Gmail SMTP go to spam without these DNS records. Users can't reset passwords → support burden.

**What to do:**
- SPF: TXT record `v=spf1 include:_spf.google.com ~all` on `onelifestack.com`
- DKIM: enable in Google Workspace → publish provided TXT record
- DMARC: TXT record `v=DMARC1; p=quarantine; rua=mailto:postmaster@onelifestack.com`
- Send a test via `mail-tester.com`, target score ≥ 9/10

**Acceptance:** Password reset email lands in inbox (not spam) on Gmail, Outlook, and ProtonMail.

**Effort:** ~1 hour (mostly DNS propagation wait)

---

### [ ] 23. Load test with k6
**Risk:** Unknown how the system behaves at 100 concurrent users. Could fall over at 20.

**What to do:**
- Write a k6 script that simulates: login → fetch dashboard → list transactions → import a file → fetch insights
- Run against staging at 1, 10, 50, 100 concurrent users
- Identify the breaking point (latency > 5s, error rate > 1%)
- Fix the slowest endpoint, repeat

**Acceptance:** Documented capacity number (e.g. "supports 50 concurrent users with p95 < 1s").

**Effort:** ~1 day

---

### [ ] 24. Container image vulnerability scanning
**Risk:** CVEs in base images go undetected until they're already exploited.

**What to do:**
- Add Trivy to CI: `trivy image localhost:30500/homelab/spends-backend:${SHA}`
- Fail build on any `HIGH` or `CRITICAL` CVE
- Pin base image to a specific digest (not `:21-jre-alpine` which floats)
- Renovate or Dependabot for monthly base image bumps

**Acceptance:** CI fails on a known-vulnerable base image. Renovate opens a PR within a week of a new base image release.

**Effort:** ~3 hours · **Files:** `ci.yml`, `Dockerfile`s

---

## Progress tracker

| # | Item | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 1 | Encrypt API keys | 🔴 | ⬜ |  |
| 2 | Password complexity | 🔴 | ⬜ |  |
| 3 | Backup restore drill | 🔴 | ⬜ |  |
| 4 | JWT rotation | 🔴 | ⬜ |  |
| 5 | HSTS + secure cookies | 🔴 | ⬜ |  |
| 6 | String length validation | 🔴 | ⬜ |  |
| 7 | Multi-replica + HPA + PDB | 🟡 | ⬜ |  |
| 8 | Postgres HA / PITR | 🟡 | ⬜ |  |
| 9 | Sentry error tracking | 🟡 | ⬜ |  |
| 10 | Metrics + Grafana | 🟡 | ⬜ |  |
| 11 | Integration tests | 🟡 | ⬜ |  |
| 12 | Per-user rate limiting | 🟡 | ⬜ |  |
| 13 | Audit log table + retention | 🟡 | ⬜ |  |
| 14 | Frontend tests | 🟡 | ⬜ |  |
| 15 | Staging + PR previews | 🟢 | ⬜ |  |
| 16 | Feature flags | 🟢 | ⬜ |  |
| 17 | OpenAPI docs | 🟢 | ⬜ |  |
| 18 | Bundle size budget | 🟢 | ⬜ |  |
| 19 | GDPR export + delete | 🟢 | ⬜ |  |
| 20 | Privacy policy + ToS | 🟢 | ⬜ |  |
| 21 | robots.txt | 🟢 | ⬜ |  |
| 22 | SPF/DKIM/DMARC | 🟢 | ⬜ |  |
| 23 | Load test | 🟢 | ⬜ |  |
| 24 | Image vulnerability scan | 🟢 | ⬜ |  |

**Total estimate:** ~6-8 weeks of focused work to complete all 24 items.
