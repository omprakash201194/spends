# Mobile-Native Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SpendStack feel like a native app on mobile: persistent bottom nav bar for the 4 primary flows, swipe-to-dismiss sidebar, and a custom "Add to Home Screen" install banner.

**Architecture:** All changes are purely frontend. A new `BottomNav` component sits fixed at the bottom (mobile only), replacing the hamburger for primary flows — the sidebar still handles secondary nav. A `useInstallPrompt` hook captures the browser's `beforeinstallprompt` event and an `InstallBanner` component surfaces it above the bottom nav. Swipe-to-dismiss uses touch events directly on the existing sidebar backdrop. No new dependencies — all built with existing React, Tailwind, lucide-react, and browser APIs.

**Tech Stack:** React 18 + TypeScript · Tailwind CSS 3 (dark mode class strategy) · lucide-react · Browser BeforeInstallPromptEvent API · `env(safe-area-inset-bottom)` CSS for iPhone notch

---

## File Map

| Status | Path | Role |
|---|---|---|
| Modify | `frontend/index.html` | Add `viewport-fit=cover` for iPhone safe area |
| Create | `frontend/src/components/BottomNav.tsx` | 4-tab + More bottom nav, mobile only |
| Modify | `frontend/src/components/Layout.tsx` | Wire BottomNav, swipe gesture on backdrop, `pb-24` on main |
| Create | `frontend/src/hooks/useInstallPrompt.ts` | Capture `beforeinstallprompt`, expose `canInstall`, `promptInstall`, `dismiss` |
| Create | `frontend/src/components/InstallBanner.tsx` | Dismissable install banner, floats above bottom nav |

---

## Task 1: Bottom Nav + Swipe-to-Dismiss

**Files:**
- Modify: `frontend/index.html`
- Create: `frontend/src/components/BottomNav.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Add `viewport-fit=cover` to index.html**

Open `frontend/index.html`. The current viewport meta is:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

Replace it with:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

This is required for `env(safe-area-inset-bottom)` to work on iPhone X and later (the CSS variable is always 0 without this flag).

- [ ] **Step 2: Create BottomNav component**

Create `frontend/src/components/BottomNav.tsx`:

```tsx
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  Upload,
  Menu,
} from 'lucide-react'
import { clsx } from 'clsx'

const primaryNav = [
  { to: '/',             label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budgets',      label: 'Budgets',      icon: PiggyBank },
  { to: '/import',       label: 'Import',       icon: Upload },
]

interface Props {
  onMoreClick: () => void
}

export default function BottomNav({ onMoreClick }: Props) {
  return (
    <nav
      className="md:hidden print:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {primaryNav.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            clsx(
              'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors',
              isActive
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400',
            )
          }
        >
          <Icon className="w-5 h-5" />
          <span>{label}</span>
        </NavLink>
      ))}
      <button
        onClick={onMoreClick}
        className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium text-gray-500 dark:text-gray-400 transition-colors"
        aria-label="Open full menu"
      >
        <Menu className="w-5 h-5" />
        <span>More</span>
      </button>
    </nav>
  )
}
```

- [ ] **Step 3: Update Layout.tsx**

Open `frontend/src/components/Layout.tsx`.

**3a — Add imports at the top:**

Add `useRef` to the React import:
```tsx
import { useState, useRef } from 'react'
```

Add the BottomNav import below the existing component imports:
```tsx
import BottomNav from './BottomNav'
```

**3b — Add `touchStartX` ref inside the component body** (after the existing state declarations):
```tsx
const touchStartX = useRef(0)
```

**3c — Add touch handlers to the mobile backdrop div.**

Find the backdrop div (currently):
```tsx
{sidebarOpen && (
  <div
    className="fixed inset-0 bg-black/50 z-40 md:hidden"
    onClick={closeSidebar}
  />
)}
```

Replace it with:
```tsx
{sidebarOpen && (
  <div
    className="fixed inset-0 bg-black/50 z-40 md:hidden"
    onClick={closeSidebar}
    onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX }}
    onTouchEnd={(e) => {
      if (e.changedTouches[0].clientX - touchStartX.current < -50) closeSidebar()
    }}
  />
)}
```

A leftward swipe of more than 50px on the backdrop closes the sidebar — mirrors native drawer behaviour.

**3d — Add bottom padding to `<main>` for the bottom nav.**

Find:
```tsx
<main className="flex-1 overflow-y-auto">
```

Replace with:
```tsx
<main className="flex-1 overflow-y-auto pb-24 md:pb-0">
```

`pb-24` = 96px — covers the ~62px nav height plus up to 34px iPhone safe-area inset added by the nav's own `paddingBottom: env(safe-area-inset-bottom)`. On desktop `md:pb-0` removes it.

**3e — Add `<BottomNav />` inside the main area `<div>`.** Find the closing tag of the main area `<div>` (the one that wraps header + main):

```tsx
      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
        <Outlet />
      </main>
    </div>
  </div>
```

Insert `<BottomNav>` between `</main>` and the closing `</div>`:

```tsx
      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
        <Outlet />
      </main>

      <BottomNav onMoreClick={() => setSidebarOpen(true)} />
    </div>
  </div>
```

- [ ] **Step 4: TypeScript compile check**

```bash
cd f:/Development/home-lab/spends/frontend && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/index.html \
        frontend/src/components/BottomNav.tsx \
        frontend/src/components/Layout.tsx
git commit -m "feat: mobile bottom nav bar + swipe-to-dismiss sidebar"
```

---

## Task 2: PWA Install Prompt

**Files:**
- Create: `frontend/src/hooks/useInstallPrompt.ts`
- Create: `frontend/src/components/InstallBanner.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Create the useInstallPrompt hook**

Create `frontend/src/hooks/useInstallPrompt.ts`:

```typescript
import { useState, useEffect } from 'react'

/**
 * BeforeInstallPromptEvent is not yet in the standard TypeScript DOM lib.
 * We define the subset we actually use.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'spends-install-dismissed'

/**
 * Captures the browser's beforeinstallprompt event (Chrome / Edge / Android)
 * and exposes controls for showing or permanently dismissing the install prompt.
 *
 * `canInstall` is false when:
 *  - the app is already installed (browser suppresses the event)
 *  - the user previously dismissed the banner (stored in localStorage)
 *  - the browser doesn't support the PWA install API (Safari, Firefox)
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === 'true'
  )

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const promptInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDeferredPrompt(null)
  }

  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem(DISMISSED_KEY, 'true')
  }

  return {
    canInstall: deferredPrompt !== null && !dismissed,
    promptInstall,
    dismiss,
  }
}
```

- [ ] **Step 2: Create InstallBanner component**

Create `frontend/src/components/InstallBanner.tsx`:

```tsx
import { Download, X } from 'lucide-react'
import { useInstallPrompt } from '../hooks/useInstallPrompt'

/**
 * Floats above the bottom nav on mobile only.
 * Renders nothing if the browser doesn't fire beforeinstallprompt
 * (Safari, already-installed apps, user previously dismissed).
 */
export default function InstallBanner() {
  const { canInstall, promptInstall, dismiss } = useInstallPrompt()

  if (!canInstall) return null

  return (
    <div
      className="md:hidden print:hidden fixed inset-x-0 z-20 mx-4"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 0.5rem)' }}
    >
      <div className="bg-blue-700 dark:bg-blue-800 text-white rounded-xl p-3 flex items-center gap-3 shadow-lg">
        <Download className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Install SpendStack</p>
          <p className="text-xs text-blue-200 leading-tight">Add to your home screen</p>
        </div>
        <button
          onClick={promptInstall}
          className="px-3 py-1.5 bg-white text-blue-700 text-xs font-semibold rounded-lg flex-shrink-0 hover:bg-blue-50 transition-colors"
        >
          Install
        </button>
        <button
          onClick={dismiss}
          className="p-1 text-blue-200 hover:text-white flex-shrink-0 transition-colors"
          aria-label="Dismiss install banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
```

The `bottom` inline style positions the banner just above the bottom nav:
- `4rem` — approximate nav height (the nav is `py-2` + icon + label ≈ 62px ≈ 4rem)
- `env(safe-area-inset-bottom)` — adds the iPhone safe area that the nav consumes
- `0.5rem` — 8px breathing room between banner and nav

- [ ] **Step 3: Wire InstallBanner into Layout**

Open `frontend/src/components/Layout.tsx`.

Add the import after the BottomNav import:
```tsx
import InstallBanner from './InstallBanner'
```

Add `<InstallBanner />` right after `<BottomNav .../>`:

```tsx
      <BottomNav onMoreClick={() => setSidebarOpen(true)} />
      <InstallBanner />
    </div>
  </div>
```

- [ ] **Step 4: TypeScript compile check**

```bash
cd f:/Development/home-lab/spends/frontend && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 5: Run backend tests (nothing changed, but confirm no regressions)**

```bash
cd f:/Development/home-lab/spends/backend && mvn test -q 2>&1 | tail -5
```

Expected: BUILD SUCCESS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useInstallPrompt.ts \
        frontend/src/components/InstallBanner.tsx \
        frontend/src/components/Layout.tsx
git commit -m "feat: PWA install prompt — useInstallPrompt hook + InstallBanner"
```
