import { FeatureGuide } from '../components/FeatureGuide'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, Target, Award, AlertTriangle, Loader2, ChevronDown,
} from 'lucide-react'
import { clsx } from 'clsx'
import { getAvailableYears, getMonthlySummary, type MonthRow } from '../api/reports'

// ── Helpers ───────────────────────────────────────────────────────────────────

function inr(n: number) {
  if (Math.abs(n) >= 100_000) return '₹' + (n / 100_000).toFixed(1) + 'L'
  if (Math.abs(n) >= 1_000)   return '₹' + (n / 1_000).toFixed(1) + 'K'
  return '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function inrFull(n: number) {
  return (n < 0 ? '−₹' : '₹') + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function monthLabel(ym: string) {
  const [, m] = ym.split('-')
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m) - 1]
}

function pct(part: number, total: number) {
  if (total === 0) return 0
  return Math.round((part / total) * 100)
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: 'green' | 'red' | 'blue'
}) {
  const colors = {
    green: 'text-emerald-600 dark:text-emerald-400',
    red:   'text-red-500 dark:text-red-400',
    blue:  'text-blue-600 dark:text-blue-400',
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={clsx('text-2xl font-bold', accent ? colors[accent] : 'text-gray-900 dark:text-white')}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ── Month bar ─────────────────────────────────────────────────────────────────

function MonthBar({ row, maxAbs, year }: { row: MonthRow; maxAbs: number; year: number }) {
  const net = row.totalIncome - row.totalSpent
  const isPositive = net >= 0
  const barPct = maxAbs > 0 ? Math.min(100, Math.abs(net) / maxAbs * 100) : 0
  const month = monthLabel(row.yearMonth)
  const txLink = `/transactions?dateFrom=${row.yearMonth}-01&dateTo=${row.yearMonth}-${new Date(year, Number(row.yearMonth.split('-')[1]), 0).getDate()}`

  return (
    <Link
      to={txLink}
      className="flex items-center gap-3 group py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg px-2 -mx-2 transition-colors"
    >
      <span className="w-8 text-xs font-medium text-gray-500 dark:text-gray-400 flex-shrink-0">{month}</span>
      <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all', isPositive ? 'bg-emerald-500' : 'bg-red-400')}
          style={{ width: `${barPct}%` }}
        />
      </div>
      <span className={clsx(
        'w-24 text-xs font-medium text-right flex-shrink-0',
        isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
      )}>
        {isPositive ? '+' : '−'}{inr(Math.abs(net))}
      </span>
      <span className="text-xs text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        →
      </span>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnnualReviewPage() {
  const { data: years = [], isLoading: yearsLoading } = useQuery({
    queryKey: ['available-years'],
    queryFn: getAvailableYears,
    staleTime: 60_000,
  })

  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const year = selectedYear ?? years[0] ?? null

  const { data, isLoading: summaryLoading } = useQuery({
    queryKey: ['annual-review', year],
    queryFn: () => getMonthlySummary(year!),
    enabled: year != null,
    staleTime: 60_000,
  })

  const isLoading = yearsLoading || summaryLoading

  // ── Derived stats ──────────────────────────────────────────────────────────
  const activeMonths: MonthRow[] = data?.months.filter(m => m.totalSpent > 0 || m.totalIncome > 0) ?? []

  const savingsRate = data && data.grandTotalIncome > 0
    ? pct(data.grandTotalIncome - data.grandTotalSpent, data.grandTotalIncome)
    : null

  const bestMonth = activeMonths.length
    ? activeMonths.reduce((a, b) => (b.totalIncome - b.totalSpent) > (a.totalIncome - a.totalSpent) ? b : a)
    : null

  const worstMonth = activeMonths.length
    ? activeMonths.reduce((a, b) => (b.totalIncome - b.totalSpent) < (a.totalIncome - a.totalSpent) ? b : a)
    : null

  const monthsInTheRed = activeMonths.filter(m => m.totalSpent > m.totalIncome).length

  // Top category — sum across all months
  const categoryTotals: Record<string, { amount: number; color: string | null }> = {}
  for (const m of activeMonths) {
    for (const c of m.categories) {
      if (!categoryTotals[c.category]) categoryTotals[c.category] = { amount: 0, color: c.color }
      categoryTotals[c.category].amount += c.amount
    }
  }
  const topCategory = Object.entries(categoryTotals)
    .sort((a, b) => b[1].amount - a[1].amount)[0] ?? null

  const maxAbsNet = activeMonths.length
    ? Math.max(...activeMonths.map(m => Math.abs(m.totalIncome - m.totalSpent)))
    : 1

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <FeatureGuide />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Annual Review</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            A year in numbers — how you did and where your money went
          </p>
        </div>

        {/* Year selector */}
        {years.length > 0 && (
          <div className="relative">
            <select
              value={year ?? ''}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {!isLoading && activeMonths.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p>No transactions found for {year}.</p>
          <Link to="/import" className="text-blue-500 hover:underline text-sm mt-2 inline-block">
            Import a statement →
          </Link>
        </div>
      )}

      {!isLoading && data && activeMonths.length > 0 && (
        <div className="space-y-6">
          {/* ── Key stats ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Total spent"
              value={inr(data.grandTotalSpent)}
              accent="red"
            />
            <StatCard
              label="Total income"
              value={inr(data.grandTotalIncome)}
              accent="green"
            />
            <StatCard
              label="Net savings"
              value={inrFull(data.grandTotalIncome - data.grandTotalSpent)}
              accent={data.grandTotalIncome >= data.grandTotalSpent ? 'green' : 'red'}
            />
            <StatCard
              label="Savings rate"
              value={savingsRate != null ? `${savingsRate}%` : '—'}
              sub={savingsRate != null
                ? savingsRate >= 20 ? '🎯 Great job' : savingsRate >= 10 ? '📈 On track' : '⚠️ Below target'
                : 'No income recorded'}
              accent={savingsRate != null && savingsRate >= 20 ? 'green' : savingsRate != null && savingsRate >= 10 ? 'blue' : 'red'}
            />
          </div>

          {/* ── Highlights ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {bestMonth && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">Best month</span>
                </div>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                  {monthLabel(bestMonth.yearMonth)}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                  +{inrFull(bestMonth.totalIncome - bestMonth.totalSpent)} net
                </p>
              </div>
            )}

            {worstMonth && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-red-500 dark:text-red-400" />
                  <span className="text-xs font-semibold text-red-600 dark:text-red-300 uppercase tracking-wide">Toughest month</span>
                </div>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">
                  {monthLabel(worstMonth.yearMonth)}
                </p>
                <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
                  {inrFull(worstMonth.totalIncome - worstMonth.totalSpent)} net
                </p>
              </div>
            )}

            {topCategory && (
              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Top category</span>
                </div>
                <div className="flex items-center gap-2">
                  {topCategory[1].color && (
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: topCategory[1].color }} />
                  )}
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-300 truncate">{topCategory[0]}</p>
                </div>
                <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">
                  {inr(topCategory[1].amount)} total
                </p>
              </div>
            )}
          </div>

          {/* Months in the red callout */}
          {monthsInTheRed > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                You spent more than you earned in{' '}
                <span className="font-semibold">{monthsInTheRed} month{monthsInTheRed !== 1 ? 's' : ''}</span>.{' '}
                Consider setting monthly budgets to stay on track.{' '}
                <Link to="/budgets" className="underline">Set budgets →</Link>
              </p>
            </div>
          )}

          {/* ── Month-by-month net bars ── */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Month-by-month net savings
              </h2>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Saved</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Deficit</span>
              </div>
            </div>
            <div className="space-y-0.5">
              {data.months.map(row => (
                row.totalSpent > 0 || row.totalIncome > 0
                  ? <MonthBar key={row.yearMonth} row={row} maxAbs={maxAbsNet} year={year!} />
                  : null
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
              Click any month to see its transactions
            </p>
          </div>

          {/* ── Top categories table ── */}
          {Object.keys(categoryTotals).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
                Spending by category
              </h2>
              <div className="space-y-2">
                {Object.entries(categoryTotals)
                  .sort((a, b) => b[1].amount - a[1].amount)
                  .slice(0, 8)
                  .map(([name, { amount, color }]) => {
                    const share = pct(amount, data.grandTotalSpent)
                    return (
                      <div key={name} className="flex items-center gap-3">
                        <div className="flex items-center gap-2 w-36 flex-shrink-0">
                          {color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />}
                          <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{name}</span>
                        </div>
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                          <div className="h-full rounded-full bg-blue-400 dark:bg-blue-500" style={{ width: `${share}%` }} />
                        </div>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-16 text-right flex-shrink-0">
                          {inr(amount)}
                        </span>
                        <span className="text-xs text-gray-400 w-8 text-right flex-shrink-0">{share}%</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* Footer links */}
          <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
            <Link to="/reports" className="hover:text-blue-500 dark:hover:text-blue-400 hover:underline flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Full monthly report
            </Link>
            <Link to="/budgets" className="hover:text-blue-500 dark:hover:text-blue-400 hover:underline flex items-center gap-1">
              <Target className="w-3 h-3" /> Set budgets for next year
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
