import React, { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import {
  TrendingDown, TrendingUp, Wallet, BarChart3, ArrowRight,
  AlertTriangle, Sparkles, ChevronUp, Repeat, Target, Bell, Building2, Calendar,
} from 'lucide-react'
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as ChartTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts'
import { getDashboardLifetime, type DashboardLifetime } from '../api/dashboard'
import { getAlerts, type AlertSummary, type Alert, type AlertType } from '../api/alerts'
import { getRecurring, type RecurringSummary } from '../api/recurring'
import { getGoals, type GoalResponse } from '../api/savingsGoals'
import { Link } from 'react-router-dom'
import InsightCard from '../components/InsightCard'

// ── Helpers ───────────────────────────────────────────────────────────────────

function inr(n: number) {
  if (n >= 10_000_000) return '₹' + (n / 10_000_000).toFixed(1) + 'Cr'
  if (n >= 100_000)    return '₹' + (n / 100_000).toFixed(1) + 'L'
  if (n >= 1000)       return '₹' + (n / 1000).toFixed(1) + 'K'
  return '₹' + n.toFixed(0)
}

function inrFull(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Compact ₹ with no decimals — used by alert rows and other lists. */
export function inrCompact(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function formatDateLong(iso: string): string {
  // "2013-08-16" → "Aug 16, 2013"
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "yyyy-MM" → "MMM yy" so 24-month axes don't overflow. */
function shortMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number)
  if (!y || !m) return yyyymm
  const monthShort = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short' })
  return `${monthShort} ${String(y).slice(2)}`
}

// Fallback palette when a category lacks a saved colour.
const FALLBACK_PALETTE = [
  '#6366f1', '#f97316', '#22c55e', '#ef4444', '#3b82f6', '#a855f7',
  '#14b8a6', '#eab308', '#ec4899', '#06b6d4', '#84cc16', '#f59e0b',
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-lifetime'],
    queryFn: getDashboardLifetime,
    staleTime: 60_000,
  })

  const { data: alertData } = useQuery<AlertSummary>({
    queryKey: ['alerts'],
    queryFn: () => getAlerts(),
    staleTime: 60_000,
  })

  const { data: recurringData } = useQuery<RecurringSummary>({
    queryKey: ['recurring'],
    queryFn: () => getRecurring(),
    staleTime: 5 * 60_000,
  })

  const { data: goalsData } = useQuery<GoalResponse[]>({
    queryKey: ['goals'],
    queryFn: getGoals,
    staleTime: 60_000,
  })

  const alertCount = alertData?.alerts.length ?? 0
  const [alertPopoverOpen, setAlertPopoverOpen] = useState(false)
  const alertRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!alertPopoverOpen) return
    const handler = (e: MouseEvent) => {
      if (alertRef.current && !alertRef.current.contains(e.target as Node)) setAlertPopoverOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [alertPopoverOpen])

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.displayName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {user?.householdName} · Lifetime overview
          </p>
        </div>

        {alertCount > 0 && (
          <div className="relative" ref={alertRef}>
            <button
              onClick={() => setAlertPopoverOpen(o => !o)}
              className="relative p-2 rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
              title="View alerts"
            >
              <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                {alertCount}
              </span>
            </button>
            {alertPopoverOpen && alertData && (
              <AlertPopover data={alertData} onClose={() => setAlertPopoverOpen(false)} />
            )}
          </div>
        )}
      </div>

      {isLoading && <LoadingSkeleton />}
      {isError  && <ErrorState />}
      {data     && (
        <DashboardContent
          data={data}
          recurringData={recurringData}
          goalsData={goalsData}
        />
      )}
    </div>
  )
}

// ── Content (loaded) ──────────────────────────────────────────────────────────

function DashboardContent({ data, recurringData, goalsData }: {
  data: DashboardLifetime
  recurringData?: RecurringSummary
  goalsData?: GoalResponse[]
}) {
  const hasData = data.summary.totalTransactions > 0

  return (
    <>
      {recurringData && recurringData.patterns.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-300">
            <Repeat className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>
              <span className="font-semibold">{recurringData.patterns.length}</span> recurring pattern
              {recurringData.patterns.length !== 1 ? 's' : ''} detected (salary, rent, subscriptions)
            </span>
          </div>
          <Link to="/recurring" className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 flex-shrink-0 ml-4">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {goalsData && goalsData.length > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-300">
            <Target className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              <span className="font-semibold">{goalsData.filter(g => g.achieved).length}</span> of{' '}
              <span className="font-semibold">{goalsData.length}</span>{' '}
              savings {goalsData.length === 1 ? 'goal' : 'goals'} achieved
            </span>
          </div>
          <Link to="/goals" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 flex-shrink-0 ml-4">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          {/* Lifetime stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-3">
            <StatCard
              label="Total Transactions"
              value={data.summary.totalTransactions.toLocaleString('en-IN')}
              sub={data.banks.length > 0
                ? `${data.banks.length} bank${data.banks.length !== 1 ? 's' : ''} · ${data.categories.length} categor${data.categories.length === 1 ? 'y' : 'ies'}`
                : ''}
              icon={BarChart3}
              iconColor="text-purple-500"
              iconBg="bg-purple-50 dark:bg-purple-950"
            />
            <StatCard
              label="Total Amount"
              value={inr(data.summary.totalAmount)}
              sub="Lifetime"
              icon={Wallet}
              iconColor="text-indigo-500"
              iconBg="bg-indigo-50 dark:bg-indigo-950"
            />
            <StatCard
              label="Total Spent"
              value={inr(data.summary.totalWithdrawals)}
              sub="All withdrawals"
              icon={TrendingDown}
              iconColor="text-red-500"
              iconBg="bg-red-50 dark:bg-red-950"
              valueClass="text-red-600 dark:text-red-400"
            />
            <StatCard
              label="Total Income"
              value={inr(data.summary.totalDeposits)}
              sub="All deposits"
              icon={TrendingUp}
              iconColor="text-green-500"
              iconBg="bg-green-50 dark:bg-green-950"
              valueClass="text-green-600 dark:text-green-400"
            />
          </div>

          {data.summary.dateStart && data.summary.dateEnd && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-6">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDateLong(data.summary.dateStart)} — {formatDateLong(data.summary.dateEnd)}</span>
            </div>
          )}

          <div className="xl:grid xl:grid-cols-[1fr_320px] xl:gap-6 xl:items-start">
            {/* Main column */}
            <div className="space-y-6">
              {/* 2×2 chart grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <CategoryDonut categories={data.categories} />
                <BankComparison banks={data.banks} />
                <MonthlyTrend points={data.monthlyTrends} />
                <YearlyTrend yearly={data.yearly} />
              </div>

              {/* Stats lists */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <TopCategoriesList categories={data.categories} />
                <BankActivityList banks={data.banks} />
              </div>
            </div>

            {/* AI insights sidebar */}
            <div className="mt-6 xl:mt-0 xl:sticky xl:top-6">
              <InsightCard type="DASHBOARD" />
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ── Charts ────────────────────────────────────────────────────────────────────

function CategoryDonut({ categories }: { categories: DashboardLifetime['categories'] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Spending by Category</h2>
      {categories.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">No spending data</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={categories}
              dataKey="amount"
              nameKey="name"
              cx="50%" cy="50%"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={1}
            >
              {categories.map((c, i) => (
                <Cell key={i} fill={c.color || FALLBACK_PALETTE[i % FALLBACK_PALETTE.length]} />
              ))}
            </Pie>
            <ChartTooltip
              formatter={(v: number) => inrFull(v)}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function BankComparison({ banks }: { banks: DashboardLifetime['banks'] }) {
  const colors = ['#6366f1', '#a855f7', '#ec4899', '#f97316', '#14b8a6']
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Bank Comparison</h2>
      {banks.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">No bank data</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={banks.map(b => ({ name: b.bankName, value: b.totalAmount }))}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} />
            <XAxis type="number" tickFormatter={inr} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
            <ChartTooltip
              formatter={(v: number) => inrFull(v)}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {banks.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function MonthlyTrend({ points }: { points: DashboardLifetime['monthlyTrends'] }) {
  const chartData = points.map(p => ({
    month: shortMonth(p.month),
    spending: p.withdrawals,
    income: p.deposits,
  }))
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Monthly Trends · last 24 months</h2>
      {chartData.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">No trend data</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tickFormatter={inr} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
            <ChartTooltip
              formatter={(v: number, name: string) => [inrFull(v), name === 'spending' ? 'Spending' : 'Income']}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="spending" stroke="#ef4444" strokeWidth={2} dot={false} name="spending" />
            <Line type="monotone" dataKey="income"   stroke="#22c55e" strokeWidth={2} dot={false} name="income" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function YearlyTrend({ yearly }: { yearly: DashboardLifetime['yearly'] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Yearly Spending Trend</h2>
      {yearly.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">No yearly data</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={yearly.map(y => ({ year: String(y.year), value: y.withdrawals }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={inr} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
            <ChartTooltip
              formatter={(v: number) => inrFull(v)}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Stats lists ───────────────────────────────────────────────────────────────

function TopCategoriesList({ categories }: { categories: DashboardLifetime['categories'] }) {
  const top = categories.slice(0, 8)
  if (top.length === 0) return null
  const max = top[0].amount
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Top Spending Categories</h2>
        <Link to="/transactions" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-3">
        {top.map((c, i) => {
          const pct = max > 0 ? (c.amount / max) * 100 : 0
          const color = c.color || FALLBACK_PALETTE[i % FALLBACK_PALETTE.length]
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{c.name}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white ml-2 flex-shrink-0">{inrFull(c.amount)}</span>
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BankActivityList({ banks }: { banks: DashboardLifetime['banks'] }) {
  if (banks.length === 0) return null
  const totalCount = banks.reduce((a, b) => a + b.transactionCount, 0)
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Bank Activity</h2>
      <div className="space-y-3">
        {banks.map((b, i) => {
          const pct = totalCount > 0 ? (b.transactionCount / totalCount) * 100 : 0
          return (
            <div key={i} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{b.bankName}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white ml-2 flex-shrink-0">
                    {b.transactionCount.toLocaleString('en-IN')} txns
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{inr(b.totalAmount)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Alert popover (preserved + exports retained for /alerts page) ─────────────

export const ALERT_META: Record<AlertType, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  LARGE_TRANSACTION: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950', label: 'Large transaction' },
  NEW_MERCHANT:      { icon: Sparkles,      color: 'text-blue-600',  bg: 'bg-blue-50 dark:bg-blue-950',  label: 'New merchant'      },
  CATEGORY_SPIKE:    { icon: TrendingUp,    color: 'text-red-600',   bg: 'bg-red-50 dark:bg-red-950',    label: 'Spending spike'    },
}

export function AlertRow({ alert }: { alert: Alert }) {
  const meta = ALERT_META[alert.type]
  const Icon = meta.icon
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${meta.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{alert.title}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{meta.label} · {alert.message}</p>
      </div>
      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex-shrink-0 ml-2">
        {inrCompact(alert.amount)}
      </span>
    </div>
  )
}

function AlertPopover({ data, onClose }: { data: AlertSummary; onClose: () => void }) {
  const preview = data.alerts.slice(0, 5)
  const hasMore = data.alerts.length > 5
  return (
    <div className="absolute right-0 top-full mt-2 z-50 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Alerts · {data.month}</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-80 overflow-y-auto">
        {preview.map((alert, i) => <AlertRow key={i} alert={alert} />)}
      </div>
      <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 text-center">
        <Link
          to="/alerts"
          onClick={onClose}
          className={`text-xs hover:underline flex items-center justify-center gap-1 ${
            hasMore ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {hasMore ? `View all ${data.alerts.length} alerts` : 'View alert history'}
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, iconColor, iconBg, valueClass,
}: {
  label: string; value: string; sub: string
  icon: React.ElementType; iconColor: string; iconBg: string
  valueClass?: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
        <span className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </span>
      </div>
      <p className={`text-xl sm:text-2xl font-bold ${valueClass ?? 'text-gray-900 dark:text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-16 text-center">
      <BarChart3 className="mx-auto w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
      <p className="text-gray-500 dark:text-gray-400 font-medium">No transactions yet</p>
      <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
        <Link to="/import" className="text-blue-600 hover:underline">Import a statement</Link> to see your spending dashboard.
      </p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-xl h-28" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-xl h-72" />)}
      </div>
    </div>
  )
}

function ErrorState() {
  return (
    <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
      <p className="text-red-600 dark:text-red-400 font-medium">Failed to load dashboard</p>
      <p className="text-sm text-red-400 dark:text-red-500 mt-1">Check backend logs for details</p>
    </div>
  )
}
