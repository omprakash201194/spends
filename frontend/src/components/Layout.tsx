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
} from 'lucide-react'
import { clsx } from 'clsx'

const nav = [
  { to: '/',            label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/accounts',    label: 'Accounts',     icon: Building2 },
  { to: '/import',      label: 'Import',       icon: Upload },
  { to: '/transactions',label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budgets',     label: 'Budgets',      icon: PiggyBank },
  { to: '/household',   label: 'Household',    icon: TrendingUp },
  { to: '/settings',    label: 'Settings',     icon: Settings },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-700">
          <TrendingUp className="w-6 h-6 text-blue-400" />
          <span className="text-lg font-bold tracking-tight">SpendStack</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                )
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User + Logout */}
        <div className="border-t border-gray-700 px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold">
              {user?.displayName?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.displayName}</p>
              <p className="text-xs text-gray-400 truncate">{user?.householdName}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
