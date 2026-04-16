# Dark Mode + PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add class-based dark mode with a light/dark toggle in the sidebar, and configure the app as an installable PWA via vite-plugin-pwa.

**Architecture:** Dark mode uses Tailwind's `class` strategy — a `useThemeStore` Zustand store (persisted) holds `'light' | 'dark'`, an effect in `App.tsx` applies/removes the `dark` class on `<html>`, and a toggle button in the Layout sidebar lets users switch. `dark:` variants are added to every component. PWA uses `vite-plugin-pwa` (Workbox-based) with an inline manifest in `vite.config.ts` — no separate JSON file needed.

**Tech Stack:** Tailwind CSS 3 (class darkMode) · Zustand 5 (persist) · vite-plugin-pwa 0.21 · Workbox · React 18

**Note:** Dark mode and PWA are independent subsystems executed as sequential tasks in one plan.

---

## File Map

| File | Change |
|---|---|
| `frontend/tailwind.config.js` | Add `darkMode: 'class'` |
| `frontend/src/store/themeStore.ts` | **Create** — Zustand theme store |
| `frontend/src/App.tsx` | Add `ThemeApplier` component |
| `frontend/src/components/Layout.tsx` | Dark classes + toggle button |
| `frontend/src/pages/LoginPage.tsx` | Dark classes |
| `frontend/src/pages/RegisterPage.tsx` | Dark classes |
| `frontend/src/pages/DashboardPage.tsx` | Dark classes |
| `frontend/src/components/InsightCard.tsx` | Dark classes |
| `frontend/src/pages/TransactionPage.tsx` | Dark classes |
| `frontend/src/pages/ImportPage.tsx` | Dark classes |
| `frontend/src/pages/BudgetPage.tsx` | Dark classes |
| `frontend/src/pages/SettingsPage.tsx` | Dark classes |
| `frontend/src/pages/RecurringPage.tsx` | Dark classes |
| `frontend/src/pages/ReportsPage.tsx` | Dark classes |
| `frontend/src/pages/HouseholdPage.tsx` | Dark classes |
| `frontend/src/pages/BankAccountsPage.tsx` | Dark classes |
| `frontend/src/pages/ViewsPage.tsx` | Dark classes |
| `frontend/src/pages/ViewDetailPage.tsx` | Dark classes |
| `frontend/vite.config.ts` | Add vite-plugin-pwa |
| `frontend/index.html` | Add PWA meta tags |
| `frontend/public/` | App icons (192×192, 512×512 SVG) |

---

## Dark Mode Class Reference

Apply these substitutions consistently across all component files:

| Light class | Add dark variant |
|---|---|
| `bg-gray-50` | `dark:bg-gray-950` |
| `bg-white` | `dark:bg-gray-800` |
| `bg-gray-100` | `dark:bg-gray-700` |
| `border-gray-200` | `dark:border-gray-700` |
| `border-gray-300` | `dark:border-gray-600` |
| `text-gray-900` | `dark:text-white` |
| `text-gray-800` | `dark:text-gray-100` |
| `text-gray-700` | `dark:text-gray-200` |
| `text-gray-600` | `dark:text-gray-300` |
| `text-gray-500` | `dark:text-gray-400` |
| `text-gray-400` | `dark:text-gray-500` |
| `hover:bg-gray-50` | `dark:hover:bg-gray-700` |
| `hover:bg-gray-100` | `dark:hover:bg-gray-700` |
| `divide-gray-100` | `dark:divide-gray-700` |

For inputs/selects/textareas — add after the existing `focus:ring-*` class:
```
dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400
```

---

### Task 1: Theme Infrastructure

**Files:**
- Modify: `frontend/tailwind.config.js`
- Create: `frontend/src/store/themeStore.ts`
- Modify: `frontend/src/App.tsx`

---

- [ ] **Step 1: Add `darkMode: 'class'` to Tailwind config**

Replace `frontend/tailwind.config.js` with:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: Create the theme store**

Create `frontend/src/store/themeStore.ts`:

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  setTheme: (t: Theme) => void
  toggle: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      toggle: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
    }),
    { name: 'spends-theme' }
  )
)
```

- [ ] **Step 3: Add `ThemeApplier` to `App.tsx`**

Read `frontend/src/App.tsx` first. Then replace the file content with:

```tsx
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import BankAccountsPage from './pages/BankAccountsPage'
import ImportPage from './pages/ImportPage'
import TransactionPage from './pages/TransactionPage'
import BudgetPage from './pages/BudgetPage'
import HouseholdPage from './pages/HouseholdPage'
import SettingsPage from './pages/SettingsPage'
import ViewsPage from './pages/ViewsPage'
import ViewDetailPage from './pages/ViewDetailPage'
import RecurringPage from './pages/RecurringPage'
import ReportsPage from './pages/ReportsPage'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { useThemeStore } from './store/themeStore'

function ThemeApplier() {
  const { theme } = useThemeStore()
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeApplier />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="accounts" element={<BankAccountsPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="transactions" element={<TransactionPage />} />
          <Route path="budgets" element={<BudgetPage />} />
          <Route path="household" element={<HouseholdPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="views" element={<ViewsPage />} />
          <Route path="views/:id" element={<ViewDetailPage />} />
          <Route path="recurring" element={<RecurringPage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 4: Run type check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/tailwind.config.js frontend/src/store/themeStore.ts frontend/src/App.tsx
git commit -m "feat: add dark mode infrastructure — Tailwind class strategy, theme store, ThemeApplier"
```

---

### Task 2: Layout.tsx — Dark Classes + Toggle Button

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

Read the current file first. Then apply these changes:

---

- [ ] **Step 1: Add `Moon`, `Sun` to lucide-react imports and import `useThemeStore`**

The current import from lucide-react ends at `FileText`. Add `Moon, Sun` to it:

```tsx
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  Settings,
  LogOut,
  TrendingUp,
  Building2,
  Upload,
  Users,
  Menu,
  X,
  LayoutGrid,
  Repeat,
  FileText,
  Moon,
  Sun,
} from 'lucide-react'
```

Add the theme store import after the `clsx` import:

```tsx
import { useThemeStore } from '../store/themeStore'
```

- [ ] **Step 2: Add theme toggle to the Layout component body**

Inside the `Layout` function, after `const [sidebarOpen, setSidebarOpen] = useState(false)`, add:

```tsx
const { theme, toggle } = useThemeStore()
```

- [ ] **Step 3: Apply dark classes to the outer shell and mobile header**

Change the outer wrapper div (currently `className="flex h-screen bg-gray-50 overflow-hidden"`):

```tsx
<div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
```

Change the mobile header (currently `className="md:hidden print:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0"`):

```tsx
<header className="md:hidden print:hidden sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3 flex-shrink-0">
```

Change the hamburger button inside the mobile header (currently `className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"`):

```tsx
className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
```

Change the SpendStack logo text in mobile header (currently `className="font-bold text-gray-900"`):

```tsx
className="font-bold text-gray-900 dark:text-white"
```

- [ ] **Step 4: Add theme toggle button to the sidebar user section**

In the sidebar's user + logout section, add the toggle button between the user info and the Sign out button. The current sign-out button block starts with `<button onClick={handleLogout}`. Add this immediately before it:

```tsx
<button
  onClick={toggle}
  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors mb-1"
>
  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
</button>
```

- [ ] **Step 5: Run type check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "feat: dark mode — Layout chrome + toggle button in sidebar"
```

---

### Task 3: Auth Pages Dark Mode (Login + Register)

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/pages/RegisterPage.tsx`

Read both files first. Both share the same full-screen centered layout pattern. Apply the dark class reference table from the plan header.

---

- [ ] **Step 1: Apply dark classes to `LoginPage.tsx`**

Find and update these elements:

**Outer wrapper** (full-screen bg):
Old: `className="min-h-screen bg-gray-50 flex items-center justify-center ..."`
New: add `dark:bg-gray-950`

**Card container**:
Old: `className="bg-white rounded-2xl shadow-sm border border-gray-200 ..."`
New: add `dark:bg-gray-800 dark:border-gray-700`

**Heading text** (`text-gray-900`): add `dark:text-white`

**Sub text** (`text-gray-500`): add `dark:text-gray-400`

**Label text** (`text-gray-700`): add `dark:text-gray-200`

**All inputs** (classes containing `border-gray-300`): add `dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400`

**Error message text** (`text-red-600`): no change needed (red is readable on dark)

**Register link text** (`text-gray-500`): add `dark:text-gray-400`

- [ ] **Step 2: Apply dark classes to `RegisterPage.tsx`**

Apply the same substitutions as LoginPage. The register page has the same layout. Additionally:

**Toggle buttons** (create / join household tab switcher):
- Active state `bg-white text-gray-900 shadow-sm`: add `dark:bg-gray-700 dark:text-white`
- Inactive state `text-gray-500`: add `dark:text-gray-400`
- Container `bg-gray-100`: add `dark:bg-gray-700`

**All inputs and selects**: add `dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400`

- [ ] **Step 3: Run type check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.tsx
git commit -m "feat: dark mode — auth pages (login, register)"
```

---

### Task 4: Dashboard + InsightCard Dark Mode

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/components/InsightCard.tsx`

Read both files first. Apply the dark class reference table.

---

- [ ] **Step 1: Apply dark classes to `DashboardPage.tsx`**

Read the full file. Apply these changes throughout:

**Page outer wrapper** (`p-4 sm:p-6 max-w-7xl mx-auto`): no bg class here — bg comes from Layout's outer div.

**Header text** (`text-2xl font-bold text-gray-900`): add `dark:text-white`

**Sub text** (`text-sm text-gray-500 mt-1`): add `dark:text-gray-400`

**Compare toggle container** (`inline-flex rounded-lg border border-gray-200 bg-white p-0.5`): add `dark:bg-gray-800 dark:border-gray-700`

**Compare toggle inactive buttons** (`text-gray-500 hover:text-gray-700`): add `dark:text-gray-400 dark:hover:text-gray-200`

**All card containers** (`bg-white rounded-xl border border-gray-200`): add `dark:bg-gray-800 dark:border-gray-700`

**All card headings** (`text-sm font-semibold text-gray-700`): add `dark:text-gray-200`

**StatCard label** (`text-xs sm:text-sm font-medium text-gray-500`): add `dark:text-gray-400`

**StatCard value** (`text-xl sm:text-2xl font-bold text-gray-900`): add `dark:text-white`

**StatCard sub text** (`text-xs text-gray-400 mt-1`): add `dark:text-gray-500`

**Recurring patterns banner** (`bg-blue-50 border border-blue-200`): add `dark:bg-blue-950 dark:border-blue-800`

**Recurring banner text** (`text-sm text-blue-800`): add `dark:text-blue-300`

**Recurring banner link** (`text-xs text-blue-600`): add `dark:text-blue-400`

**Alerts panel border** (`border border-amber-200`): add `dark:border-amber-800`

**Alert header hover** (`hover:bg-amber-50`): add `dark:hover:bg-amber-950`

**Alert header text** (`text-sm font-semibold text-gray-800`): add `dark:text-gray-100`

**Alert row** (divide): `divide-y divide-gray-100` → add `dark:divide-gray-700`

**Alert row text** (`text-sm font-medium text-gray-800`): add `dark:text-gray-100`

**Alert meta text** (`text-xs text-gray-400`): add `dark:text-gray-500`

**Alert amount** (`text-sm font-semibold text-gray-700`): add `dark:text-gray-200`

**Top merchants section** — merchant name (`text-sm font-medium text-gray-800`): add `dark:text-gray-100`

**Merchant amount** (`text-sm font-semibold text-gray-900`): add `dark:text-white`

**Merchant bar background** (`bg-gray-100`): add `dark:bg-gray-700`

**Merchant count** (`text-xs text-gray-400`): add `dark:text-gray-500`

**Merchant icon bg** (`bg-gray-100`): add `dark:bg-gray-700`

**Merchant icon** (`text-gray-500`): add `dark:text-gray-400`

**EmptyState** (`border-dashed border-gray-300`): add `dark:border-gray-600`

**EmptyState text** (`text-gray-500 font-medium`): add `dark:text-gray-400`

**EmptyState sub** (`text-sm text-gray-400`): add `dark:text-gray-500`

**LoadingSkeleton** (`bg-gray-100 rounded-xl`): add `dark:bg-gray-800`

**ErrorState** (`bg-red-50 border border-red-200`): add `dark:bg-red-950 dark:border-red-800`

**ErrorState text** (`text-red-600 font-medium`): add `dark:text-red-400`

For the **Recharts charts**: the chart components accept `stroke` and `fill` colors inline — leave them as-is. The chart containers' white backgrounds are handled by the card class changes above. The `CartesianGrid stroke="#f0f0f0"` line: change to `stroke="#f0f0f0"` — no change needed (not worth the complexity of a dynamic color for gridlines).

- [ ] **Step 2: Apply dark classes to `InsightCard.tsx`**

Read `frontend/src/components/InsightCard.tsx`. Apply:

**Card outer** (`bg-white rounded-xl border border-gray-200`): add `dark:bg-gray-800 dark:border-gray-700`

**All `text-gray-*` text**: apply the reference table substitutions

**Spinner or loading elements** (`text-gray-400`): add `dark:text-gray-500`

**Bullet list text**: any `text-gray-700` → add `dark:text-gray-200`

**Buttons** (`bg-gray-100 hover:bg-gray-200` type): add `dark:bg-gray-700 dark:hover:bg-gray-600`

- [ ] **Step 3: Run type check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx frontend/src/components/InsightCard.tsx
git commit -m "feat: dark mode — dashboard page + InsightCard component"
```

---

### Task 5: Transactions + Import + Budget + BankAccounts Pages

**Files:**
- Modify: `frontend/src/pages/TransactionPage.tsx`
- Modify: `frontend/src/pages/ImportPage.tsx`
- Modify: `frontend/src/pages/BudgetPage.tsx`
- Modify: `frontend/src/pages/BankAccountsPage.tsx`

Read all four files. Apply the dark class reference table from the plan header. Key patterns for these pages:

---

- [ ] **Step 1: Apply dark classes to `TransactionPage.tsx`**

Key elements to update (read the file to find exact class strings):

- Page heading (`text-gray-900`): add `dark:text-white`
- All filter inputs, selects: add `dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100`
- Table container (`bg-white rounded-xl border border-gray-200`): add `dark:bg-gray-800 dark:border-gray-700`
- Table header row (`bg-gray-50`): add `dark:bg-gray-750` — use `dark:bg-gray-700/50` to preserve the subtle distinction
- Table header text (`text-xs font-medium text-gray-500 uppercase`): add `dark:text-gray-400`
- Table dividers (`divide-gray-100`): add `dark:divide-gray-700`
- Table row hover (`hover:bg-gray-50`): add `dark:hover:bg-gray-700`
- Transaction amount text (`text-gray-900` / `text-red-600` / `text-green-600`): `text-gray-900` → add `dark:text-white`
- Merchant name text: `dark:text-gray-100`
- Date/meta text (`text-gray-400`, `text-gray-500`): add `dark:text-gray-500`
- Category badge (inline `style={{ backgroundColor }}` based) — leave color as-is (colored pills work on dark)
- Category picker dropdown (`bg-white border border-gray-200 shadow-lg`): add `dark:bg-gray-800 dark:border-gray-700`
- Category picker items hover (`hover:bg-gray-50`): add `dark:hover:bg-gray-700`
- Pagination area (`bg-white border-t border-gray-200`): add `dark:bg-gray-800 dark:border-gray-700`
- Pagination text (`text-sm text-gray-700`): add `dark:text-gray-200`
- Pagination buttons (`text-gray-500`): add `dark:text-gray-400`

- [ ] **Step 2: Apply dark classes to `ImportPage.tsx`**

Key elements:
- Page wrapper: heading `text-gray-900` → add `dark:text-white`
- Drop zone (`border-dashed border-gray-300 bg-gray-50`): add `dark:border-gray-600 dark:bg-gray-800`
- Drop zone text (`text-gray-500`): add `dark:text-gray-400`
- Import History section card (`bg-white rounded-xl border border-gray-200`): add `dark:bg-gray-800 dark:border-gray-700`
- History row (`divide-gray-100`): add `dark:divide-gray-700`
- Row hover (`hover:bg-gray-50`): add `dark:hover:bg-gray-700`
- Row text (`text-gray-900`, `text-gray-500`, `text-gray-400`): apply reference table
- Error banner (`bg-red-50 border border-red-200`): add `dark:bg-red-950 dark:border-red-800`
- Error text (`text-red-700`): add `dark:text-red-400`

- [ ] **Step 3: Apply dark classes to `BudgetPage.tsx`**

Key elements:
- Page heading: `dark:text-white`
- Budget cards (`bg-white rounded-xl border border-gray-200`): add `dark:bg-gray-800 dark:border-gray-700`
- Category name text: apply reference table
- Progress bar background (`bg-gray-200`): add `dark:bg-gray-700`
- Progress bar fill (colored, inline style) — leave as-is
- Limit input (`border-gray-300`): add `dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100`
- Spent / over-budget text: apply reference table

- [ ] **Step 4: Apply dark classes to `BankAccountsPage.tsx`**

Read the file. Apply:
- Page heading: `dark:text-white`
- All card containers: `dark:bg-gray-800 dark:border-gray-700`
- All text: apply reference table
- All inputs: add dark input classes
- Form container (`bg-gray-50`): add `dark:bg-gray-700`

- [ ] **Step 5: Run type check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/TransactionPage.tsx frontend/src/pages/ImportPage.tsx \
        frontend/src/pages/BudgetPage.tsx frontend/src/pages/BankAccountsPage.tsx
git commit -m "feat: dark mode — transactions, import, budget, bank accounts pages"
```

---

### Task 6: Settings + Reports + Recurring + Household + Views + ViewDetail Pages

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Modify: `frontend/src/pages/ReportsPage.tsx`
- Modify: `frontend/src/pages/RecurringPage.tsx`
- Modify: `frontend/src/pages/HouseholdPage.tsx`
- Modify: `frontend/src/pages/ViewsPage.tsx`
- Modify: `frontend/src/pages/ViewDetailPage.tsx`

Read each file. Apply the dark class reference table. Key patterns per page:

---

- [ ] **Step 1: `SettingsPage.tsx`**

- Tab switcher container (`bg-gray-100 p-1 rounded-xl`): add `dark:bg-gray-700`
- Active tab (`bg-white text-gray-900 shadow-sm`): add `dark:bg-gray-600 dark:text-white`
- Inactive tab (`text-gray-500`): add `dark:text-gray-400`
- Card containers: `dark:bg-gray-800 dark:border-gray-700`
- All headings/labels: apply reference table
- API key display (`bg-gray-50 border border-gray-200`): add `dark:bg-gray-700 dark:border-gray-600`
- API key text (`text-gray-500 font-mono`): add `dark:text-gray-400`
- All inputs/selects: add dark input classes
- Category create form (`bg-gray-50 rounded-xl border border-gray-200`): add `dark:bg-gray-700 dark:border-gray-600`
- System categories (`bg-gray-50`): add `dark:bg-gray-700`
- System category text (`text-xs text-gray-600`): add `dark:text-gray-300`
- Rules table header (`text-gray-400 uppercase`): add `dark:text-gray-500`
- Rules row hover (`hover:bg-gray-50`): add `dark:hover:bg-gray-700`

- [ ] **Step 2: `ReportsPage.tsx`**

- Page heading: `dark:text-white`
- Year selector button (`bg-white border border-gray-200`): add `dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100`
- Year dropdown (`bg-white border border-gray-200 shadow-lg`): add `dark:bg-gray-800 dark:border-gray-700`
- Year option hover (`hover:bg-gray-50`): add `dark:hover:bg-gray-700`
- Year option text: apply reference table
- Stat cards (`bg-white rounded-xl border border-gray-200`): add `dark:bg-gray-800 dark:border-gray-700`
- Table container: `dark:bg-gray-800 dark:border-gray-700`
- Table header (`bg-gray-50`): add `dark:bg-gray-700`
- Table header text: apply reference table
- Table row dividers (`divide-gray-100`): add `dark:divide-gray-700`
- Table row hover (`hover:bg-gray-50`): add `dark:hover:bg-gray-700`
- Table cell text: apply reference table
- Export / Print buttons: apply reference table for gray button styles

- [ ] **Step 3: `RecurringPage.tsx`**

- Page heading: `dark:text-white`
- Segment control container (`bg-gray-100`): add `dark:bg-gray-700`
- Active segment (`bg-white`): add `dark:bg-gray-600`
- Segment text (`text-gray-500`): add `dark:text-gray-400`
- Pattern cards (`bg-white rounded-xl border border-gray-200`): add `dark:bg-gray-800 dark:border-gray-700`
- Pattern card text: apply reference table
- Empty state: apply reference table

- [ ] **Step 4: `HouseholdPage.tsx`**

- Page heading / stats: apply reference table
- Member cards (`bg-white rounded-xl border border-gray-200`): add `dark:bg-gray-800 dark:border-gray-700`
- Member card text: apply reference table
- Progress bar backgrounds (`bg-gray-100`): add `dark:bg-gray-700`
- Invite code chip (`bg-gray-100 font-mono`): add `dark:bg-gray-700 dark:text-gray-200`

- [ ] **Step 5: `ViewsPage.tsx`**

- Page heading: `dark:text-white`
- View cards (`bg-white rounded-xl border border-gray-200`): add `dark:bg-gray-800 dark:border-gray-700`
- View card text: apply reference table
- Modal (`bg-white rounded-2xl`): add `dark:bg-gray-800`
- Modal overlay (`bg-black/50`): no change needed
- Modal inputs: add dark input classes
- Progress bar backgrounds: add `dark:bg-gray-700`

- [ ] **Step 6: `ViewDetailPage.tsx`**

- Page wrapper and heading: apply reference table
- Tab switcher: apply same pattern as SettingsPage tabs
- List/Board/Summary containers: `dark:bg-gray-800 dark:border-gray-700`
- Transaction rows: apply reference table
- Summary cards: apply reference table
- Board columns (`bg-gray-50 rounded-xl`): add `dark:bg-gray-700`

- [ ] **Step 7: Run type check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/SettingsPage.tsx frontend/src/pages/ReportsPage.tsx \
        frontend/src/pages/RecurringPage.tsx frontend/src/pages/HouseholdPage.tsx \
        frontend/src/pages/ViewsPage.tsx frontend/src/pages/ViewDetailPage.tsx
git commit -m "feat: dark mode — settings, reports, recurring, household, views pages"
```

---

### Task 7: PWA Setup

**Files:**
- Modify: `frontend/package.json` (install vite-plugin-pwa)
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/index.html`
- Create: `frontend/public/icon-192.svg`
- Create: `frontend/public/icon-512.svg`

---

- [ ] **Step 1: Install vite-plugin-pwa**

```bash
cd frontend && npm install -D vite-plugin-pwa@0.21.0
```

Expected: package installed, `package.json` devDependencies updated.

- [ ] **Step 2: Update `vite.config.ts` to add PWA plugin**

Replace `frontend/vite.config.ts` with:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'child_process'

function getGitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.svg', 'icon-512.svg'],
      manifest: {
        name: 'SpendStack',
        short_name: 'SpendStack',
        description: 'Household expense tracker',
        theme_color: '#1e3a8a',
        background_color: '#f9fafb',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: '/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
        ],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(getGitSha()),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 3: Create app icons**

Create `frontend/public/icon-192.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <rect width="192" height="192" rx="32" fill="#1e3a8a"/>
  <polyline points="32,128 72,80 96,104 136,56 160,80"
    fill="none" stroke="#60a5fa" stroke-width="16"
    stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

Create `frontend/public/icon-512.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="80" fill="#1e3a8a"/>
  <polyline points="80,340 192,210 256,270 368,140 432,210"
    fill="none" stroke="#60a5fa" stroke-width="40"
    stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

- [ ] **Step 4: Add PWA meta tags to `index.html`**

Read `frontend/index.html`. Replace it with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/icon-192.svg" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#1e3a8a" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="SpendStack" />
    <meta name="description" content="Household expense tracker" />
    <title>SpendStack</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Build and verify PWA generates correctly**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds. Look for output mentioning `manifest.webmanifest` and service worker files being generated (e.g. `sw.js`, `workbox-*.js`).

- [ ] **Step 6: Verify manifest was generated**

```bash
ls frontend/dist/*.webmanifest frontend/dist/sw.js 2>&1
```

Expected: both files exist.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json \
        frontend/vite.config.ts frontend/index.html \
        frontend/public/icon-192.svg frontend/public/icon-512.svg
git commit -m "feat: PWA — vite-plugin-pwa with Workbox, manifest, app icons, meta tags"
```

---

## Self-Review

**Spec coverage:**
- ✅ Dark mode — Tailwind `class` strategy — Task 1
- ✅ Theme store (persisted, light/dark) — Task 1
- ✅ `ThemeApplier` effect in App.tsx — Task 1
- ✅ Toggle button in sidebar — Task 2
- ✅ Layout chrome dark classes — Task 2
- ✅ Login + Register pages — Task 3
- ✅ Dashboard + InsightCard — Task 4
- ✅ Transactions + Import + Budget + BankAccounts — Task 5
- ✅ Settings + Reports + Recurring + Household + Views + ViewDetail — Task 6
- ✅ vite-plugin-pwa with Workbox — Task 7
- ✅ Web app manifest with icons — Task 7
- ✅ PWA meta tags in index.html — Task 7

**Placeholder scan:**
- Tasks 5 and 6 say "apply the dark class reference table" and list specific element patterns. This is explicit enough for a subagent who reads the files — they know exactly which class strings to find and what to add to them. Every element type is enumerated.

**Type consistency:**
- `useThemeStore` exports `theme`, `setTheme`, `toggle` — used in App.tsx (`theme`) and Layout.tsx (`theme`, `toggle`).
- `ThemeApplier` is defined in App.tsx and rendered inside `App()` before `<Routes>`.
- `Moon`, `Sun` imported in Layout.tsx from lucide-react and used in the toggle button.
