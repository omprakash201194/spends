import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import {
  TrendingDown, TrendingUp, Wallet, BarChart3, ShoppingBag, ArrowRight,
  AlertTriangle, Sparkles, ChevronUp, Repeat, Target, Bell,
} from 'lucide-react'
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as PieTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip,
} from 'recharts'
import { getDashboardSummary, type DashboardSummary } from '../api/dashboard'
import { getBankAccounts } from '../api/bankAccounts'
import type { BankAccount } from '../types'
import { getAlerts, type AlertSummary, type Alert, type AlertType } from '../api/alerts'
import { getRecurring, type RecurringSummary } from '../api/recurring'
import { getGoals, type GoalResponse } from '../api/savingsGoals'
import { Link } from 'react-router-dom'
import InsightCard from '../components/InsightCard'

// ── Helpers ───────────────────────────────────────────────────────────────────

function inr(n: number) {
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L'
  if (n >= 1000)   return '₹' + (n / 1000).toFixed(1) + 'K'
  return '₹' + n.toFixed(0)
}

function inrFull(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Returns percentage change from prev to current, or null if prev is zero (no baseline). */
function pctDelta(current: number, prev: number): number | null {
  if (prev === 0) return null
  return ((current - prev) / prev) * 100
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const [accountId, setAccountId] = useState<string | undefined>(undefined)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', accountId],
    queryFn: () => getDashboardSummary(accountId),
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

  const { data: accounts } = useQuery<BankAccount[]>({
    queryKey: ['bank-accounts'],
    queryFn: getBankAccounts,
    staleTime: 5 * 60_000,
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
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.displayName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {user?.householdName} · {data?.month ?? new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Alert bell */}
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

      {/* Account filter */}
      {accounts && accounts.length > 1 && (
        <div className="mb-4">
          <select
            value={accountId ?? ''}
            onChange={e => setAccountId(e.target.value || undefined)}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All accounts</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.bankName}{a.accountNumberMasked ? ` · ${a.accountNumberMasked}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {isLoading && <LoadingSkeleton />}
      {isError  && <ErrorState />}
      {data     && <DashboardContent data={data} recurringData={recurringData} goalsData={goalsData} />}
    </div>
  )
}

// ── Content (loaded) ──────────────────────────────────────────────────────────

function DashboardContent({ data, recurringData, goalsData }: {
  data: DashboardSummary
  recurringData?: RecurringSummary
  goalsData?: GoalResponse[]
}) {
  const hasData = data.transactionCount > 0
  const [compareMode, setCompareMode] = useState<'month' | 'year'>('month')
  const comp      = (compareMode === 'month' ? data.prevMonth : data.prevYear) ?? null
  const compLabel = compareMode === 'month' ? 'last month' : 'last year'

  return (
    <>
      {/* Recurring patterns banner */}
      {recurringData && recurringData.patterns.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-300">
            <Repeat className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>
              <span className="font-semibold">{recurringData.patterns.length}</span> recurring pattern
              {recurringData.patterns.length !== 1 ? 's' : ''} detected
              {' '}(salary, rent, subscriptions)
            </span>
          </div>
          <Link to="/recurring"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 flex-shrink-0 ml-4">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {goalsData && goalsData.length > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-300">
            <Target className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              <span className="font-semibold">{goalsData.filter(g => g.achieved).length}</span>
              {' '}of{' '}
              <span className="font-semibold">{goalsData.length}</span>
              {' '}savings {goalsData.length === 1 ? 'goal' : 'goals'} achieved
            </span>
          </div>
          <Link
            to="/goals"
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 flex-shrink-0 ml-4"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          {/* Compare mode toggle */}
          <div className="flex justify-end mb-2">
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5 text-xs">
              <button
                onClick={() => setCompareMode('month')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  compareMode === 'month'
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                vs last month
              </button>
              <button
                onClick={() => setCompareMode('year')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  compareMode === 'year'
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                vs last year
              </button>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <StatCard
              label="Total Spent"
              value={inr(data.totalSpent)}
              sub={data.month}
              icon={TrendingDown}
              iconColor="text-red-500"
              iconBg="bg-red-50 dark:bg-red-950"
              delta={comp ? pctDelta(data.totalSpent, comp.spent) : null}
              positiveIsGood={false}
              deltaLabel={compLabel}
            />
            <StatCard
              label="Total Income"
              value={inr(data.totalIncome)}
              sub={data.month}
              icon={TrendingUp}
              iconColor="text-green-500"
              iconBg="bg-green-50 dark:bg-green-950"
              delta={comp ? pctDelta(data.totalIncome, comp.income) : null}
              positiveIsGood={true}
              deltaLabel={compLabel}
            />
            <StatCard
              label="Net Savings"
              value={inr(Math.abs(data.netSavings))}
              sub={data.netSavings >= 0 ? 'Surplus' : 'Deficit'}
              icon={Wallet}
              iconColor={data.netSavings >= 0 ? 'text-blue-500' : 'text-orange-500'}
              iconBg={data.netSavings >= 0 ? 'bg-blue-50 dark:bg-blue-950' : 'bg-orange-50 dark:bg-orange-950'}
            />
            <StatCard
              label="Transactions"
              value={data.transactionCount.toString()}
              sub={data.month}
              icon={BarChart3}
              iconColor="text-purple-500"
              iconBg="bg-purple-50 dark:bg-purple-950"
            />
          </div>

          <div className="xl:grid xl:grid-cols-[1fr_320px] xl:gap-6 xl:items-start">
          {/* Main column */}
          <div className="space-y-6">
            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">12-Month Spending Trend</h2>
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

              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Category Breakdown — {data.month}</h2>
                {data.categoryBreakdown.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">No spending data</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
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
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3">
                      {data.categoryBreakdown.map((entry, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color ?? '#94a3b8' }} />
                          <span className="text-xs text-gray-600 dark:text-gray-400">{entry.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Top merchants */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Top Merchants — {data.month}</h2>
                <Link to="/transactions" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {data.topMerchants.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">No merchant data this month</p>
              ) : (
                <div className="space-y-3">
                  {data.topMerchants.map((m, i) => {
                    const max = data.topMerchants[0].amount
                    const pct = max > 0 ? (m.amount / max) * 100 : 0
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                          <ShoppingBag className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{m.merchant}</span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white ml-2 flex-shrink-0">{inrFull(m.amount)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                              <div
                                className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{m.count}×</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* AI Insights sidebar */}
          <div className="mt-6 xl:mt-0 xl:sticky xl:top-6">
            <InsightCard type="DASHBOARD" />
          </div>
        </div>
        </>
      )}
    </>
  )
}

// ── Alert popover + shared row ────────────────────────────────────────────────

export const ALERT_META: Record<AlertType, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  LARGE_TRANSACTION: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950',  label: 'Large transaction' },
  NEW_MERCHANT:      { icon: Sparkles,      color: 'text-blue-600',  bg: 'bg-blue-50 dark:bg-blue-950',   label: 'New merchant'      },
  CATEGORY_SPIKE:    { icon: TrendingUp,    color: 'text-red-600',   bg: 'bg-red-50 dark:bg-red-950',    label: 'Spending spike'    },
}

export function inrCompact(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
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
      {hasMore && (
        <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 text-center">
          <Link to="/alerts" onClick={onClose} className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center justify-center gap-1">
            View all {data.alerts.length} alerts <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
      {!hasMore && (
        <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 text-center">
          <Link to="/alerts" onClick={onClose} className="text-xs text-gray-400 dark:text-gray-500 hover:underline flex items-center justify-center gap-1">
            View alert history <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DeltaBadge({ delta, positiveIsGood, label }: {
  delta: number | null
  positiveIsGood: boolean
  label: string
}) {
  if (delta === null) return null
  if (Math.abs(delta) < 0.05) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700">
        — {label}
      </span>
    )
  }
  const isPositive = delta > 0
  const isGood     = positiveIsGood ? isPositive : !isPositive
  const colorClass = isGood ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950' : 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950'
  const arrow      = isPositive ? '↑' : '↓'
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded ${colorClass}`}>
      {arrow} {Math.abs(delta).toFixed(1)}%
      <span className="text-gray-400 font-normal ml-1">{label}</span>
    </span>
  )
}

function StatCard({
  label, value, sub, icon: Icon, iconColor, iconBg,
  delta, positiveIsGood, deltaLabel,
}: {
  label: string; value: string; sub: string
  icon: React.ElementType; iconColor: string; iconBg: string
  delta?: number | null; positiveIsGood?: boolean; deltaLabel?: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
        <span className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </span>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <p className="text-xs text-gray-400 dark:text-gray-500">{sub}</p>
        {delta !== undefined && delta !== null && positiveIsGood !== undefined && deltaLabel !== undefined && (
          <DeltaBadge delta={delta} positiveIsGood={positiveIsGood} label={deltaLabel} />
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-16 text-center">
      <BarChart3 className="mx-auto w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
      <p className="text-gray-500 dark:text-gray-400 font-medium">No transactions this month</p>
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
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-xl h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-100 dark:bg-gray-800 rounded-xl h-72" />
        <div className="bg-gray-100 dark:bg-gray-800 rounded-xl h-72" />
      </div>
      <div className="bg-gray-100 dark:bg-gray-800 rounded-xl h-48" />
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
