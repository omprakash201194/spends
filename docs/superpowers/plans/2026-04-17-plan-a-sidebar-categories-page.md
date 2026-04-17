# Sidebar Nav Restructure + Standalone Categories & Rules Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat sidebar nav with 5 collapsible labelled sections, and promote Categories & Rules from Settings tabs into a dedicated `/categories` page in the sidebar.

**Architecture:** A new Zustand `navStore` persists section collapse state to localStorage. `Layout.tsx` renders the 5 groups using that store. `CategoriesPage.tsx` is extracted verbatim from `SettingsPage.tsx` (CategoriesTab + RulesTab + shared components), then `SettingsPage.tsx` loses those two tabs.

**Tech Stack:** React 18, TypeScript, TanStack Query v5, Zustand persist, Tailwind CSS 3, lucide-react, react-router-dom v6

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/store/navStore.ts` | Create | Zustand persist store: `openSections: Record<string, boolean>`, `toggle(key)` |
| `frontend/src/components/Layout.tsx` | Modify | Replace flat `nav` array with 5 grouped sections; each section has a header + collapsible body |
| `frontend/src/pages/CategoriesPage.tsx` | Create | Standalone page with System categories view + Custom categories CRUD + Rules CRUD |
| `frontend/src/pages/SettingsPage.tsx` | Modify | Remove `categories` and `rules` tabs; remove their imports |
| `frontend/src/App.tsx` | Modify | Add `<Route path="categories" element={<CategoriesPage />} />` |

---

### Task 1: navStore — persist collapsible section state

**Files:**
- Create: `frontend/src/store/navStore.ts`

- [ ] **Step 1: Write the failing test**

No test needed — pure Zustand persist store with no logic to test.

- [ ] **Step 2: Create the store**

```typescript
// frontend/src/store/navStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface NavState {
  openSections: Record<string, boolean>
  toggle: (key: string) => void
}

export const useNavStore = create<NavState>()(
  persist(
    (set, get) => ({
      openSections: {
        spend:   true,
        plan:    true,
        insights: true,
        manage:  true,
        social:  true,
      },
      toggle: (key) =>
        set({ openSections: { ...get().openSections, [key]: !get().openSections[key] } }),
    }),
    { name: 'spends-nav' },
  ),
)
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/store/navStore.ts
git commit -m "feat: add navStore for persisted sidebar section collapse state"
```

---

### Task 2: Rewrite Layout.tsx with 5 collapsible sections

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

The 5 groups (keys match navStore.openSections):

| Key | Label | Items |
|-----|-------|-------|
| `spend` | Spend | Dashboard, Transactions, Categories & Rules |
| `plan` | Plan | Budgets, Goals, Net Worth |
| `insights` | Insights | Recurring, Reports, Data Health |
| `manage` | Manage | Import, Accounts, Merchant Aliases |
| `social` | Social | Views, Settlements, Household |

Settings stays pinned at the bottom (not in any group).

- [ ] **Step 1: Write the failing test**

No logic test needed — this is a rendering change. Manual verification in browser.

- [ ] **Step 2: Rewrite Layout.tsx**

Replace the entire `nav` array and the `nav.map(...)` block with the grouped sections below. Keep everything outside the nav block (logo, user area, mobile backdrop, main area) unchanged.

```typescript
// frontend/src/components/Layout.tsx
import { useState, useRef } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  LayoutDashboard, ArrowLeftRight, PiggyBank, Settings, LogOut,
  TrendingUp, Building2, Upload, Users, Menu, X, LayoutGrid,
  Repeat, FileText, Moon, Sun, ShieldCheck, Target, Tag, ChevronDown,
  Scissors, Wallet,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useThemeStore } from '../store/themeStore'
import { useNavStore } from '../store/navStore'
import BottomNav from './BottomNav'
import InstallBanner from './InstallBanner'

const NAV_GROUPS = [
  {
    key: 'spend',
    label: 'Spend',
    items: [
      { to: '/',            label: 'Dashboard',          icon: LayoutDashboard },
      { to: '/transactions',label: 'Transactions',       icon: ArrowLeftRight  },
      { to: '/categories',  label: 'Categories & Rules', icon: Tag             },
    ],
  },
  {
    key: 'plan',
    label: 'Plan',
    items: [
      { to: '/budgets',     label: 'Budgets',   icon: PiggyBank  },
      { to: '/goals',       label: 'Goals',     icon: Target     },
      { to: '/net-worth',   label: 'Net Worth', icon: TrendingUp },
    ],
  },
  {
    key: 'insights',
    label: 'Insights',
    items: [
      { to: '/recurring',   label: 'Recurring',    icon: Repeat     },
      { to: '/reports',     label: 'Reports',      icon: FileText   },
      { to: '/data-health', label: 'Data Health',  icon: ShieldCheck},
    ],
  },
  {
    key: 'manage',
    label: 'Manage',
    items: [
      { to: '/import',            label: 'Import',            icon: Upload   },
      { to: '/accounts',          label: 'Accounts',          icon: Building2},
      { to: '/merchant-aliases',  label: 'Merchant Aliases',  icon: Tag      },
    ],
  },
  {
    key: 'social',
    label: 'Social',
    items: [
      { to: '/views',       label: 'Views',       icon: LayoutGrid },
      { to: '/settlements', label: 'Settlements', icon: Wallet     },
      { to: '/household',   label: 'Household',   icon: Users      },
    ],
  },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { theme, toggle } = useThemeStore()
  const { openSections, toggle: toggleSection } = useNavStore()
  const touchStartX = useRef(0)

  const handleLogout = () => { logout(); navigate('/login') }
  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeSidebar}
          onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX }}
          onTouchEnd={(e) => {
            if (e.changedTouches[0].clientX - touchStartX.current < -50) closeSidebar()
          }}
          onTouchCancel={() => { touchStartX.current = 0 }}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white flex flex-col',
          'transition-transform duration-200 ease-in-out',
          'md:relative md:z-auto md:translate-x-0 md:flex',
          'print:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          if (e.changedTouches[0].clientX - touchStartX.current < -50) closeSidebar()
        }}
        onTouchCancel={() => { touchStartX.current = 0 }}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-700 flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-blue-400 flex-shrink-0" />
              <span className="text-lg font-bold tracking-tight">SpendStack</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-mono">build {__APP_VERSION__}</p>
          </div>
          <button
            className="md:hidden p-1 text-gray-400 hover:text-white rounded mt-0.5"
            onClick={closeSidebar}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Grouped nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
          {NAV_GROUPS.map(group => {
            const isOpen = openSections[group.key] ?? true
            return (
              <div key={group.key}>
                {/* Section header */}
                <button
                  onClick={() => toggleSection(group.key)}
                  className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
                >
                  {group.label}
                  <ChevronDown
                    className={clsx(
                      'w-3.5 h-3.5 transition-transform duration-200',
                      isOpen ? 'rotate-0' : '-rotate-90',
                    )}
                  />
                </button>

                {/* Section items */}
                {isOpen && (
                  <div className="space-y-0.5 mb-2">
                    {group.items.map(({ to, label, icon: Icon }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        onClick={closeSidebar}
                        className={({ isActive }) =>
                          clsx(
                            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-400 hover:bg-gray-800 hover:text-white',
                          )
                        }
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Settings — always visible, not in a group */}
          <NavLink
            to="/settings"
            onClick={closeSidebar}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mt-2',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white',
              )
            }
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            Settings
          </NavLink>
        </nav>

        {/* User + controls */}
        <div className="border-t border-gray-700 px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {user?.displayName?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.displayName}</p>
              <p className="text-xs text-gray-400 truncate">{user?.householdName}</p>
            </div>
          </div>
          <button
            onClick={toggle}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors mb-1"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden print:hidden sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            <span className="font-bold text-gray-900 dark:text-white">SpendStack</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
          <Outlet />
        </main>

        <BottomNav onMoreClick={() => setSidebarOpen(true)} />
        <InstallBanner />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

- Navigate to app. Sidebar should show 5 labelled sections.
- Click a section header — items collapse/expand with ChevronDown rotating.
- Refresh page — collapsed state persists (localStorage key `spends-nav`).
- Settings link is always visible below the groups.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "feat: grouped collapsible sidebar nav with 5 sections"
```

---

### Task 3: Create standalone CategoriesPage.tsx

**Files:**
- Create: `frontend/src/pages/CategoriesPage.tsx`

Extract `CategoriesTab`, `RulesTab`, `ColourPicker`, `RuleForm`, `COLOUR_SWATCHES`, and all their imports from `SettingsPage.tsx`. Wrap them in a page layout with two tabs (Categories | Rules).

- [ ] **Step 1: Create the file**

```typescript
// frontend/src/pages/CategoriesPage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, X, Check, Trash2, Tag, Sliders, ChevronDown, ChevronRight,
} from 'lucide-react'
import {
  getCategories, createCategory, updateCategory, deleteCategory,
  type Category,
} from '../api/categories'
import {
  getCategoryRules, createCategoryRule, updateCategoryRule, deleteCategoryRule,
  type CategoryRule,
} from '../api/categoryRules'

// ── Colour palette ────────────────────────────────────────────────────────────

const COLOUR_SWATCHES = [
  '#f87171', '#fb923c', '#fbbf24', '#a3e635',
  '#34d399', '#22d3ee', '#60a5fa', '#a78bfa',
  '#f472b6', '#94a3b8', '#6b7280', '#1d4ed8',
]

// ── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'categories' | 'rules'

export default function CategoriesPage() {
  const [tab, setTab] = useState<Tab>('categories')

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          Categories &amp; Rules
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Organise spending categories and auto-classification rules
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl w-fit">
        {([
          { id: 'categories', label: 'Categories', icon: Tag     },
          { id: 'rules',      label: 'Rules',      icon: Sliders },
        ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'categories' && <CategoriesTab />}
      {tab === 'rules'      && <RulesTab />}
    </div>
  )
}

// ── CategoriesTab ─────────────────────────────────────────────────────────────

function CategoriesTab() {
  const qc = useQueryClient()
  const { data: cats = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  })

  const [showForm, setShowForm]   = useState(false)
  const [newName, setNewName]     = useState('')
  const [newColor, setNewColor]   = useState(COLOUR_SWATCHES[5])
  const [editId, setEditId]       = useState<string | null>(null)
  const [editName, setEditName]   = useState('')
  const [editColor, setEditColor] = useState('')

  const createMutation = useMutation({
    mutationFn: () => createCategory(newName.trim(), newColor),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      setNewName('')
      setNewColor(COLOUR_SWATCHES[5])
      setShowForm(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (id: string) => updateCategory(id, editName.trim(), editColor),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      setEditId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })

  const systemCats = cats.filter(c => c.system)
  const customCats = cats.filter(c => !c.system)

  const startEdit = (c: Category) => {
    setEditId(c.id)
    setEditName(c.name)
    setEditColor(c.color ?? COLOUR_SWATCHES[5])
  }

  if (isLoading) {
    return <div className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">Loading…</div>
  }

  return (
    <div className="space-y-6">
      {/* Custom categories */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Custom Categories</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">Shared across your household</p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New Category
            </button>
          )}
        </div>

        {showForm && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="flex gap-2 mb-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Category name…"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                onKeyDown={e => {
                  if (e.key === 'Enter' && newName.trim()) createMutation.mutate()
                  if (e.key === 'Escape') setShowForm(false)
                }}
                autoFocus
              />
              <div
                className="w-9 h-9 rounded-lg border-2 border-gray-300 dark:border-gray-500 flex-shrink-0"
                style={{ backgroundColor: newColor }}
              />
            </div>
            <ColourPicker value={newColor} onChange={setNewColor} />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => createMutation.mutate()}
                disabled={!newName.trim() || createMutation.isPending}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Create
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 text-gray-500 dark:text-gray-400 text-xs hover:text-gray-700 dark:hover:text-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {customCats.length === 0 && !showForm ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
            No custom categories yet. Create one to get started.
          </p>
        ) : (
          <div className="space-y-1">
            {customCats.map(cat => (
              <div key={cat.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                {editId === cat.id ? (
                  <>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: editColor }} />
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                      onKeyDown={e => {
                        if (e.key === 'Enter') updateMutation.mutate(cat.id)
                        if (e.key === 'Escape') setEditId(null)
                      }}
                      autoFocus
                    />
                    <ColourPicker value={editColor} onChange={setEditColor} />
                    <button onClick={() => updateMutation.mutate(cat.id)} className="text-blue-500 hover:text-blue-600">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color ?? '#94a3b8' }} />
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">{cat.name}</span>
                    <button onClick={() => startEdit(cat)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(cat.id)}
                      disabled={deleteMutation.isPending}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System categories (read-only) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">System Categories</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Built-in categories — cannot be modified</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {systemCats.map(cat => (
            <div
              key={cat.id}
              className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color ?? '#94a3b8' }} />
              <span className="text-sm text-gray-600 dark:text-gray-300">{cat.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── RulesTab ──────────────────────────────────────────────────────────────────

function RulesTab() {
  const qc = useQueryClient()
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['category-rules'],
    queryFn: getCategoryRules,
  })
  const { data: cats = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  })

  const [showForm, setShowForm]       = useState(false)
  const [newPattern, setNewPattern]   = useState('')
  const [newCatId, setNewCatId]       = useState('')
  const [newPriority, setNewPriority] = useState(0)

  const [editId, setEditId]             = useState<string | null>(null)
  const [editPattern, setEditPattern]   = useState('')
  const [editCatId, setEditCatId]       = useState('')
  const [editPriority, setEditPriority] = useState(0)

  const createMutation = useMutation({
    mutationFn: () => createCategoryRule(newPattern.trim(), newCatId, newPriority),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['category-rules'] })
      setNewPattern('')
      setNewCatId('')
      setNewPriority(0)
      setShowForm(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (id: string) => updateCategoryRule(id, {
      pattern: editPattern.trim(),
      categoryId: editCatId,
      priority: editPriority,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['category-rules'] })
      setEditId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCategoryRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['category-rules'] }),
  })

  if (isLoading) {
    return <div className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">Loading…</div>
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Categorization Rules</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Patterns matched against merchant name / UPI handle on import
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Rule
          </button>
        )}
      </div>

      {showForm && (
        <RuleForm
          pattern={newPattern}
          catId={newCatId}
          priority={newPriority}
          cats={cats}
          onPatternChange={setNewPattern}
          onCatChange={setNewCatId}
          onPriorityChange={setNewPriority}
          onSave={() => createMutation.mutate()}
          onCancel={() => setShowForm(false)}
          isPending={createMutation.isPending}
        />
      )}

      {rules.length === 0 && !showForm ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
          No rules yet. Add one to auto-categorize future imports.
        </p>
      ) : (
        <div className="space-y-1 mt-2">
          {rules.map(rule => (
            <div key={rule.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              {editId === rule.id ? (
                <RuleForm
                  pattern={editPattern}
                  catId={editCatId}
                  priority={editPriority}
                  cats={cats}
                  onPatternChange={setEditPattern}
                  onCatChange={setEditCatId}
                  onPriorityChange={setEditPriority}
                  onSave={() => updateMutation.mutate(rule.id)}
                  onCancel={() => setEditId(null)}
                  isPending={updateMutation.isPending}
                />
              ) : (
                <>
                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400 w-6 text-right flex-shrink-0">{rule.priority}</span>
                  <span className="flex-1 text-sm font-mono text-gray-700 dark:text-gray-200 truncate">{rule.pattern}</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cats.find(c => c.id === rule.categoryId)?.color ?? '#94a3b8' }} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {cats.find(c => c.id === rule.categoryId)?.name ?? '—'}
                    </span>
                  </div>
                  <button
                    onClick={() => { setEditId(rule.id); setEditPattern(rule.pattern); setEditCatId(rule.categoryId); setEditPriority(rule.priority) }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(rule.id)}
                    disabled={deleteMutation.isPending}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function ColourPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLOUR_SWATCHES.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${value === c ? 'ring-2 ring-offset-1 ring-gray-400 dark:ring-offset-gray-700 scale-110' : ''}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  )
}

function RuleForm({
  pattern, catId, priority, cats,
  onPatternChange, onCatChange, onPriorityChange,
  onSave, onCancel, isPending,
}: {
  pattern: string
  catId: string
  priority: number
  cats: Category[]
  onPatternChange: (v: string) => void
  onCatChange: (v: string) => void
  onPriorityChange: (v: number) => void
  onSave: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2 items-center mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <input
        value={pattern}
        onChange={e => onPatternChange(e.target.value)}
        placeholder="Pattern (regex or keyword)"
        className="flex-1 min-w-40 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      <select
        value={catId}
        onChange={e => onCatChange(e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        <option value="">-- Category --</option>
        {cats.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <input
        type="number"
        value={priority}
        onChange={e => onPriorityChange(Number(e.target.value))}
        placeholder="Priority"
        className="w-20 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      <button
        onClick={onSave}
        disabled={!pattern.trim() || !catId || isPending}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        Save
      </button>
      <button
        onClick={onCancel}
        className="px-3 py-1.5 text-gray-500 dark:text-gray-400 text-xs hover:text-gray-700 dark:hover:text-gray-200"
      >
        Cancel
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/CategoriesPage.tsx
git commit -m "feat: standalone CategoriesPage with Categories and Rules tabs"
```

---

### Task 4: Register route in App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add import and route**

Add after the `MerchantAliasesPage` import:
```typescript
import CategoriesPage from './pages/CategoriesPage'
```

Add inside the nested routes block (after the `transactions` route):
```typescript
<Route path="categories" element={<CategoriesPage />} />
```

- [ ] **Step 2: Verify navigation**

Click "Categories & Rules" in the sidebar. Page loads with Categories and Rules tabs. Both tabs work (create/edit/delete categories, create/edit/delete rules).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add /categories route for standalone CategoriesPage"
```

---

### Task 5: Remove Categories and Rules tabs from SettingsPage

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Remove tab enum entry and tab buttons**

Change `type Tab = 'apikey' | 'notifications' | 'categories' | 'rules' | 'danger'`
→ `type Tab = 'apikey' | 'notifications' | 'danger'`

Remove the two entries from the tabs array:
```typescript
// Remove these two:
{ id: 'categories',   label: 'Categories',    icon: Tag           },
{ id: 'rules',        label: 'Rules',         icon: Sliders       },
```

Remove the two conditional renders:
```typescript
// Remove these:
{tab === 'categories'    && <CategoriesTab />}
{tab === 'rules'         && <RulesTab />}
```

- [ ] **Step 2: Remove the function bodies**

Delete the entire `CategoriesTab` function (lines 247–448) and `RulesTab` function (lines 452–610).

Delete `ColourPicker` function and `RuleForm` function (lines 779–865) — they now live in `CategoriesPage.tsx`.

- [ ] **Step 3: Remove now-unused imports**

Remove from the import block:
```typescript
// Remove from lucide-react imports: Tag, Sliders (if not used elsewhere in SettingsPage)
// Remove from api imports:
import { getCategories, createCategory, updateCategory, deleteCategory, type Category } from '../api/categories'
import { getCategoryRules, createCategoryRule, updateCategoryRule, deleteCategoryRule, type CategoryRule } from '../api/categoryRules'
```

Keep `Tag` if it's used elsewhere in SettingsPage; otherwise remove it. Check remaining code: `Key, Trash2, Check, ExternalLink, Plus, Pencil, X, Bell, AlertTriangle` are all still needed.

- [ ] **Step 4: Verify Settings page**

Navigate to `/settings`. Should show 3 tabs: API Key, Notifications, Danger Zone. No Categories or Rules tabs.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/SettingsPage.tsx
git commit -m "refactor: remove Categories and Rules tabs from Settings (moved to /categories)"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ 5 collapsible grouped sections in sidebar
- ✅ Collapse state persisted to localStorage
- ✅ Categories & Rules at `/categories` below Transactions in Spend group
- ✅ Settings pinned at bottom outside groups
- ✅ Categories and Rules tabs removed from Settings

**Placeholder scan:** No placeholders — all code is complete.

**Type consistency:** `Category`, `CategoryRule` types come from their respective API files and are used consistently across `CategoriesPage.tsx`.
