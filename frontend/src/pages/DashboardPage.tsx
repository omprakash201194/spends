import { useAuthStore } from '../store/authStore'
import { TrendingDown, TrendingUp, Wallet, BarChart3 } from 'lucide-react'

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.displayName} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {user?.householdName} · {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Spent"
          value="—"
          sub="This month"
          icon={TrendingDown}
          iconColor="text-red-500"
          iconBg="bg-red-50"
        />
        <StatCard
          label="Total Income"
          value="—"
          sub="This month"
          icon={TrendingUp}
          iconColor="text-green-500"
          iconBg="bg-green-50"
        />
        <StatCard
          label="Net Savings"
          value="—"
          sub="This month"
          icon={Wallet}
          iconColor="text-blue-500"
          iconBg="bg-blue-50"
        />
        <StatCard
          label="Transactions"
          value="—"
          sub="This month"
          icon={BarChart3}
          iconColor="text-purple-500"
          iconBg="bg-purple-50"
        />
      </div>

      {/* Placeholder content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center min-h-64">
          <div className="text-center text-gray-400">
            <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">Monthly spending chart</p>
            <p className="text-xs mt-1">Import your bank statement to get started</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <Wallet className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">Category breakdown</p>
            <p className="text-xs mt-1">Coming soon</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  label: string
  value: string
  sub: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  )
}
