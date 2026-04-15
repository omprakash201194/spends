import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import {
  TrendingDown, TrendingUp, Wallet, BarChart3, ShoppingBag, ArrowRight,
} from 'lucide-react'
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as PieTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip,
} from 'recharts'
import { getDashboardSummary, type DashboardSummary } from '../api/dashboard'
import { Link } from 'react-router-dom'

// ── Helpers ───────────────────────────────────────────────────────────────────

function inr(n: number) {
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L'
  if (n >= 1000)   return '₹' + (n / 1000).toFixed(1) + 'K'
  return '₹' + n.toFixed(0)
}

function inrFull(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardSummary,
    staleTime: 60_000,
  })

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.displayName}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {user?.householdName} · {data?.month ?? new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {isLoading && <LoadingSkeleton />}
      {isError  && <ErrorState />}
      {data     && <DashboardContent data={data} />}
    </div>
  )
}

// ── Content (loaded) ──────────────────────────────────────────────────────────

function DashboardContent({ data }: { data: DashboardSummary }) {
  const hasData = data.transactionCount > 0

  return (
    <>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Total Spent"   value={inr(data.totalSpent)}   sub={data.month} icon={TrendingDown} iconColor="text-red-500"    iconBg="bg-red-50"    />
        <StatCard label="Total Income"  value={inr(data.totalIncome)}  sub={data.month} icon={TrendingUp}   iconColor="text-green-500"  iconBg="bg-green-50"  />
        <StatCard label="Net Savings"   value={inr(Math.abs(data.netSavings))} sub={data.netSavings >= 0 ? 'Surplus' : 'Deficit'} icon={Wallet} iconColor={data.netSavings >= 0 ? 'text-blue-500' : 'text-orange-500'} iconBg={data.netSavings >= 0 ? 'bg-blue-50' : 'bg-orange-50'} />
        <StatCard label="Transactions"  value={data.transactionCount.toString()} sub={data.month} icon={BarChart3} iconColor="text-purple-500" iconBg="bg-purple-50" />
      </div>

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">12-Month Spending Trend</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.monthlyTrend} barSize={12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={inr} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
                  <BarTooltip
                    formatter={(val: number, name: string) => [inrFull(val), name === 'spent' ? 'Spent' : 'Income']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                  <Bar dataKey="spent"  fill="#f87171" radius={[3, 3, 0, 0]} name="spent"  />
                  <Bar dataKey="income" fill="#4ade80" radius={[3, 3, 0, 0]} name="income" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Category Breakdown — {data.month}</h2>
              {data.categoryBreakdown.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No spending data</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={data.categoryBreakdown}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%" cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {data.categoryBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color ?? '#94a3b8'} />
                      ))}
                    </Pie>
                    <PieTooltip
                      formatter={(val: number) => inrFull(val)}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top merchants */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Top Merchants — {data.month}</h2>
              <Link to="/transactions" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {data.topMerchants.length === 0 ? (
              <p className="text-sm text-gray-400">No merchant data this month</p>
            ) : (
              <div className="space-y-3">
                {data.topMerchants.map((m, i) => {
                  const max = data.topMerchants[0].amount
                  const pct = max > 0 ? (m.amount / max) * 100 : 0
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <ShoppingBag className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-800 truncate">{m.merchant}</span>
                          <span className="text-sm font-semibold text-gray-900 ml-2 flex-shrink-0">{inrFull(m.amount)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0">{m.count}×</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, iconColor, iconBg,
}: {
  label: string; value: string; sub: string
  icon: React.ElementType; iconColor: string; iconBg: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs sm:text-sm font-medium text-gray-500">{label}</span>
        <span className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </span>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center">
      <BarChart3 className="mx-auto w-10 h-10 text-gray-300 mb-3" />
      <p className="text-gray-500 font-medium">No transactions this month</p>
      <p className="text-sm text-gray-400 mt-1">
        <Link to="/import" className="text-blue-600 hover:underline">Import a statement</Link> to see your spending dashboard.
      </p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-xl h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-100 rounded-xl h-72" />
        <div className="bg-gray-100 rounded-xl h-72" />
      </div>
      <div className="bg-gray-100 rounded-xl h-48" />
    </div>
  )
}

function ErrorState() {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
      <p className="text-red-600 font-medium">Failed to load dashboard</p>
      <p className="text-sm text-red-400 mt-1">Check backend logs for details</p>
    </div>
  )
}
