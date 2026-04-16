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
