import { useState, useRef } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
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
  ShieldCheck,
  Target,
  Tag,
  ChevronDown,
  Wallet,
  Bell,
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
      { to: '/',             label: 'Dashboard',        icon: LayoutDashboard },
      { to: '/transactions', label: 'Transactions',     icon: ArrowLeftRight },
      { to: '/categories',   label: 'Categories & Rules', icon: Tag },
    ],
  },
  {
    key: 'plan',
    label: 'Plan',
    items: [
      { to: '/budgets',   label: 'Budgets',   icon: PiggyBank },
      { to: '/goals',     label: 'Goals',     icon: Target },
      { to: '/net-worth', label: 'Net Worth', icon: TrendingUp },
    ],
  },
  {
    key: 'insights',
    label: 'Insights',
    items: [
      { to: '/recurring',    label: 'Recurring',    icon: Repeat },
      { to: '/alerts',       label: 'Alerts',       icon: Bell },
      { to: '/reports',      label: 'Reports',      icon: FileText },
      { to: '/data-health',  label: 'Data Health',  icon: ShieldCheck },
    ],
  },
  {
    key: 'manage',
    label: 'Manage',
    items: [
      { to: '/import',            label: 'Import',            icon: Upload },
      { to: '/accounts',          label: 'Accounts',          icon: Building2 },
      { to: '/merchant-aliases',  label: 'Merchant Aliases',  icon: Tag },
    ],
  },
  {
    key: 'social',
    label: 'Social',
    items: [
      { to: '/views',       label: 'Views',       icon: LayoutGrid },
      { to: '/settlements', label: 'Settlements', icon: Wallet },
      { to: '/household',   label: 'Household',   icon: Users },
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

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">

      {/* ── Mobile backdrop ─────────────────────────────────────────── */}
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

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
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
          {/* Close button — mobile only */}
          <button
            className="md:hidden p-1 text-gray-400 hover:text-white rounded mt-0.5"
            onClick={closeSidebar}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {NAV_GROUPS.map((group) => {
            const isOpen = openSections[group.key] ?? true
            return (
              <div key={group.key}>
                <button
                  onClick={() => toggleSection(group.key)}
                  className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
                >
                  {group.label}
                  <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform duration-200', isOpen ? 'rotate-0' : '-rotate-90')} />
                </button>
                {isOpen && (
                  <div className="space-y-0.5 mb-2">
                    {group.items.map(({ to, label, icon: Icon }) => (
                      <NavLink key={to} to={to} end={to === '/'} onClick={closeSidebar}
                        className={({ isActive }) => clsx(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                          isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                        )}>
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Settings — pinned, always visible */}
          <NavLink to="/settings" onClick={closeSidebar}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mt-1',
              isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            )}>
            <Settings className="w-4 h-4 flex-shrink-0" />
            Settings
          </NavLink>
        </nav>

        {/* User + Logout */}
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

      {/* ── Main area ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
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

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
          <Outlet />
        </main>

        <BottomNav onMoreClick={() => setSidebarOpen(true)} />
        <InstallBanner />
      </div>
    </div>
  )
}
