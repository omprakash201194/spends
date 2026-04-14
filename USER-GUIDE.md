# SpendStack — User Guide

Your self-hosted household expense manager.
Live at **https://spends.homelab.local** · Source at [github.com/omprakash201194/spends](https://github.com/omprakash201194/spends)

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Accounts & Households](#2-accounts--households)
3. [Bank Accounts](#3-bank-accounts) _(coming — Phase 2)_
4. [Importing Statements](#4-importing-statements) _(coming — Phase 2)_
5. [Transactions](#5-transactions) _(coming — Phase 3)_
6. [Dashboard](#6-dashboard) _(coming — Phase 4)_
7. [Budgets](#7-budgets) _(coming — Phase 5)_
8. [Household View](#8-household-view) _(coming — Phase 6)_
9. [Unusual Transactions](#9-unusual-transactions) _(coming — Phase 7)_
10. [Running Locally](#10-running-locally)
11. [Deploying to Homelab](#11-deploying-to-homelab)

---

## 1. Getting Started

### Access the app

| Environment | URL |
|---|---|
| Local dev | http://localhost:5173 |
| Homelab (production) | https://spends.homelab.local |

> For the homelab URL to work on your Windows machine, `spends.homelab.local` must be in your hosts file and Tailscale must be connected. See [Section 11](#11-deploying-to-homelab).

---

## 2. Accounts & Households

SpendStack is built around **households** — a group of people (e.g. a family) who share a view of combined spending. Every user belongs to exactly one household.

### Creating your account (first person)

1. Open the app and click **Create one** or go to `/register`
2. Select **New household**
3. Fill in the form:

| Field | Example | Notes |
|---|---|---|
| Household name | `Gautam Family` | Shown in the sidebar and household view |
| Display name | `Om Gautam` | Your name as shown in the app |
| Username | `om_gautam` | Letters, numbers, underscores only |
| Email | `om@example.com` | Used for identification |
| Password | — | Minimum 8 characters |

4. Click **Create account**
5. You are now signed in as the household **Admin**

> **Your invite code** — After registering, open Settings (coming in a future phase) to find your household's 8-character invite code. Share it with family members so they can join.

---

### Joining an existing household

If someone in your household has already created an account and shared their invite code with you:

1. Go to `/register`
2. Select **Join existing**
3. Enter the **invite code** (8 characters, e.g. `A3KP9WXZ`)
4. Fill in your display name, username, email, and password
5. Click **Create account**

You will join as a **Member** and immediately see the shared household view.

---

### Signing in

1. Go to `/login`
2. Enter your **username** and **password**
3. Click **Sign in**

Your session is stored locally (JWT, 24-hour expiry). You will stay signed in until you sign out or the token expires.

---

### Signing out

Click your name in the bottom-left of the sidebar → **Sign out**.

---

### Roles

| Role | What they can do |
|---|---|
| **Admin** | Manage household, invite members, manage all accounts and rules |
| **Member** | Manage their own bank accounts, import statements, set personal budgets |

> Both roles can view the full household dashboard.

---

## 3. Bank Accounts

> **Coming in Phase 2**

You will be able to add one or more bank accounts under your profile. Each account holds its own imported transactions.

**Planned fields:**
- Bank name (e.g. ICICI, HDFC, Axis)
- Account type (Savings, Current, Credit Card)
- Masked account number (for display only)
- Currency (default: INR)

Multiple accounts per user are supported. The household view aggregates across all accounts of all members.

---

## 4. Importing Statements

> **Coming in Phase 2**

### Supported formats

| Bank | Format | Notes |
|---|---|---|
| ICICI Bank | `.xls` (OpTransactionHistory export) | Fully supported |
| Others | — | Coming in later phases |

### How to export from ICICI NetBanking

1. Log in to ICICI NetBanking
2. Go to **Accounts → Account Statement**
3. Select your date range (you can select up to 1 year at a time)
4. Choose format: **Excel (.xls)**
5. Download the file

### Importing into SpendStack

1. Go to your **Bank Account** page
2. Click **Import Statement**
3. Select one or more `.xls` files (you can import multiple years at once)
4. Click **Upload**
5. SpendStack will:
   - Parse all transactions from the file
   - Skip any duplicates already in the database
   - Auto-categorize each transaction using your category rules
   - Show you a summary: _"847 imported, 12 duplicates skipped"_

### Duplicate detection

SpendStack generates a unique fingerprint for each transaction based on date, amount, and remarks. Re-importing the same file is safe — duplicates are silently skipped.

---

## 5. Transactions

> **Coming in Phase 3**

### Transaction list

The Transactions page shows all transactions across your bank accounts, with:

- **Filters:** date range, category, account, type (debit/credit), amount range
- **Search:** by merchant name or raw remarks
- **Sorting:** by date (default), amount, or merchant

### Editing a transaction

Click any transaction row to:
- Change its **category**
- Edit the **merchant name** (if auto-parsed incorrectly)
- Mark it as **reviewed**

### Training the auto-categorizer

When you change a category, SpendStack asks:

> _"Always categorize transactions from **thegarage1@icici** as Food & Dining?"_

Click **Yes** to create a category rule. Future imports will automatically categorize this merchant correctly.

---

## 6. Dashboard

> **Coming in Phase 4**

The dashboard gives you a monthly overview of your finances.

### Summary cards

| Card | What it shows |
|---|---|
| Total Spent | Sum of all debits this month |
| Total Income | Sum of all credits this month |
| Net Savings | Income minus spending |
| Transactions | Count of transactions this month |

### Charts

- **Monthly trend** — Bar chart of income vs. spending for the last 12 months
- **Category breakdown** — Donut chart of spending by category this month
- **Balance over time** — Line chart of your running bank balance

### Top merchants

The 5 merchants you spent the most with this month, with amounts.

---

## 7. Budgets

> **Coming in Phase 5**

Set a monthly spending limit for any category and track your progress against it.

### Setting a budget

1. Go to **Budgets**
2. Click **Add Budget**
3. Select a category (e.g. Food & Dining) and enter a monthly limit (e.g. ₹8,000)
4. Click **Save**

### Budget status

Each budget shows a progress bar:

| Colour | Meaning |
|---|---|
| 🟢 Green | Under 75% of budget used |
| 🟡 Yellow | 75–99% used |
| 🔴 Red | Over budget |

> Example: _"Food & Dining — ₹6,200 of ₹8,000 (78%)"_

Budgets are monthly — they reset automatically at the start of each month.

---

## 8. Household View

> **Coming in Phase 6**

The household view aggregates spending across **all members** of your household.

### What you can see

- Combined income and spending for the household this month
- A per-member breakdown — how much each person spent
- Category-wise charts across the whole household

> Useful for understanding joint expenses like rent, groceries, and utilities.

---

## 9. Unusual Transactions

> **Coming in Phase 7**

SpendStack flags transactions that look out of the ordinary and surfaces them in a **Review** panel on the dashboard.

### What gets flagged

| Signal | Example |
|---|---|
| Large single transaction | Any debit above ₹10,000 (configurable) |
| New merchant | A merchant you have never transacted with before |
| Category spending spike | Food spending is 200% of your 3-month average |

### Reviewing flagged transactions

1. Click a flagged transaction in the Review panel
2. Either **mark as reviewed** (it's expected) or **recategorize** it if it was miscategorized

---

## 10. Running Locally

Use the included PowerShell script to start everything with one command.

### Prerequisites

| Tool | Install |
|---|---|
| Java 21 | `winget install EclipseAdoptium.Temurin.21.JDK` |
| Maven | `winget install Apache.Maven` |
| Node.js 20 | `winget install OpenJS.NodeJS.LTS` |
| kubectl | `winget install Kubernetes.kubectl` |
| Tailscale | Connected and authenticated |

### Start

```powershell
cd f:\Development\home-lab\spends
.\dev-start.ps1
```

The script will:
1. Check all prerequisites
2. Verify cluster connectivity (Tailscale must be on)
3. Retrieve the database password from the k8s secret automatically
4. Generate a JWT secret on first run (saved to `.dev-secrets`, gitignored)
5. Start PostgreSQL port-forward silently in the background
6. Open the Spring Boot backend in a new terminal window
7. Wait for the backend health endpoint to be `UP`
8. Open the React dev server in a new terminal window
9. Open `http://localhost:5173` in your browser

### Stop

```powershell
.\dev-start.ps1 -Stop
```

### Dev URLs

| Service | URL |
|---|---|
| App (frontend) | http://localhost:5173 |
| API | http://localhost:8080/api |
| Health check | http://localhost:8080/actuator/health |

---

## 11. Deploying to Homelab

### One-time cluster setup

**1. Create the JWT secret** (run on any machine with kubectl access):
```bash
kubectl create secret generic spends-secret \
  --from-literal=jwt-secret=$(openssl rand -base64 64) \
  -n homelab
```

**2. Add the hostname to your Windows hosts file** (run as Administrator):
```
100.76.108.123  spends.homelab.local
```

**3. Apply Kubernetes manifests:**
```powershell
kubectl apply -f k8s/ -n homelab
```

### Manual deploy (without CI runner)

```powershell
# Build and push backend
mvn -f backend/pom.xml package -DskipTests
docker build -t 100.76.108.123:30500/homelab/spends-backend:1.0.0 backend/
docker push 100.76.108.123:30500/homelab/spends-backend:1.0.0

# Build and push frontend
cd frontend; npm run build; cd ..
docker build -t 100.76.108.123:30500/homelab/spends-frontend:1.0.0 frontend/
docker push 100.76.108.123:30500/homelab/spends-frontend:1.0.0

# Roll out
kubectl set image deployment/spends-backend spends-backend=localhost:30500/homelab/spends-backend:1.0.0 -n homelab
kubectl set image deployment/spends-frontend spends-frontend=localhost:30500/homelab/spends-frontend:1.0.0 -n homelab
```

### Automated CI/CD

GitHub Actions runs on every push to `main`:
- **GitHub-hosted runners** — build and test backend + frontend
- **Self-hosted runner** (on the homelab server) — build Docker images, push to registry, roll out via kubectl

To register the self-hosted runner:
1. Go to [github.com/omprakash201194/spends/settings/actions/runners](https://github.com/omprakash201194/spends/settings/actions/runners)
2. Click **New self-hosted runner** → Linux
3. Follow the instructions on the homelab server
4. Configure it as a `systemd` service so it survives reboots

### Verify deployment

```powershell
kubectl get pods -n homelab -l app=spends-backend
kubectl get pods -n homelab -l app=spends-frontend
kubectl logs -n homelab -l app=spends-backend --tail=50
```

Then open **https://spends.homelab.local** in your browser.

---

## Categories Reference

These 12 categories are available out of the box. You cannot delete system categories, but you can add custom sub-categories (coming in a future phase).

| Category | Icon colour | Typical transactions |
|---|---|---|
| Food & Dining | 🟠 Orange | Swiggy, Zomato, restaurants, cafes, groceries |
| Transport | 🔵 Blue | Ola, Uber, RedBus, petrol, metro |
| Rent & Housing | 🟣 Purple | Monthly rent, maintenance, society charges |
| Utilities | 🟡 Yellow | Electricity, water, broadband, gas |
| Entertainment | 🩷 Pink | Netflix, Prime, cinema, concerts |
| Health & Medical | 🔴 Red | Pharmacy, hospital, doctor consultations |
| Shopping | 🩵 Teal | Amazon, Flipkart, clothing, electronics |
| Family Transfers | 💜 Violet | Money sent to family members |
| Savings & Investments | 🟢 Green | SIP, FD, RD, savings transfers |
| Financial | ⬛ Slate | Credit card bill payments |
| Income | 🟩 Emerald | Salary, freelance, reimbursements |
| Miscellaneous | ⬜ Gray | Anything that doesn't match |
