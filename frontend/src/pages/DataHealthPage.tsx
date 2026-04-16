import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, AlertCircle, BookOpen, Copy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getDataHealthReport, type NearDuplicate } from '../api/dataHealth'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatAmount(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Health bar ────────────────────────────────────────────────────────────────

function HealthBar({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? 'bg-emerald-500' :
    pct >= 60 ? 'bg-amber-400' :
                'bg-red-500'
  return (
    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
      <div
        className={`h-3 rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
    </div>
  )
}

// ── Near-duplicate row ────────────────────────────────────────────────────────

function DupRow({ dup }: { dup: NearDuplicate }) {
  return (
    <tr className="border-t border-gray-100 dark:border-gray-700">
      <td className="py-3 pr-4 text-sm text-gray-700 dark:text-gray-300">{formatDate(dup.date)}</td>
      <td className="py-3 pr-4 text-sm text-gray-600 dark:text-gray-400 font-mono text-xs">{dup.accountLabel}</td>
      <td className="py-3 pr-4 text-sm font-medium text-gray-900 dark:text-white">{formatAmount(dup.amount)}</td>
      <td className="py-3 text-sm">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
          {dup.count}× duplicate
        </span>
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DataHealthPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['data-health'],
    queryFn: getDataHealthReport,
    staleTime: 5 * 60_000,
  })

  const wellCategorized = data
    ? Math.max(0, data.transactions.total - data.transactions.uncategorized - data.transactions.miscellaneous)
    : 0
  const categorizationPct = data && data.transactions.total > 0
    ? Math.round((wellCategorized / data.transactions.total) * 100)
    : 0

  const dateRange = data
    ? `${formatDate(data.transactions.earliestDate)} – ${formatDate(data.transactions.latestDate)}`
    : '—'

  if (isLoading) {
    return (
      <div className="p-4 sm:p-8 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            ))}
          </div>
          <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="p-4 sm:p-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>Failed to load data health report. Please try again.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-7 h-7 text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data Health</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Audit uncategorized transactions, rule coverage, and near-duplicate candidates
          </p>
        </div>
      </div>

      {/* Overview stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Transactions" value={data.transactions.total.toLocaleString()} />
        <StatCard label="Bank Accounts" value={data.transactions.accountCount} />
        <StatCard label="Date Range" value={dateRange} />
      </div>

      {/* Categorization health */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Categorization Health</h2>
          <span className={`text-2xl font-bold ${
            categorizationPct >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
            categorizationPct >= 60 ? 'text-amber-600 dark:text-amber-400' :
                                      'text-red-600 dark:text-red-400'
          }`}>
            {categorizationPct}%
          </span>
        </div>
        <HealthBar pct={categorizationPct} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {wellCategorized.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Well-categorized</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-400 mt-1 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {data.transactions.miscellaneous.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Fell through to Miscellaneous
              </p>
              {data.transactions.miscellaneous > 0 && (
                <Link
                  to="/transactions"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Review in Transactions →
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500 mt-1 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {data.transactions.uncategorized.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Uncategorized (null)</p>
            </div>
          </div>
        </div>
        {data.transactions.miscellaneous > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
            Tip: add more rules in{' '}
            <Link to="/rules" className="text-blue-600 dark:text-blue-400 hover:underline">Rules</Link>
            {' '}to reduce Miscellaneous transactions automatically on future imports.
          </p>
        )}
      </div>

      {/* Rule coverage */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Rule Coverage</h2>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {data.rules.userRules}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your custom rules</p>
            <Link
              to="/rules"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
            >
              Manage rules →
            </Link>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {data.rules.globalRules}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Built-in global rules</p>
          </div>
        </div>
      </div>

      {/* Near-duplicate candidates */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Copy className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Near-Duplicate Candidates
          </h2>
          {data.nearDuplicates.length > 0 && (
            <span className="ml-auto text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
              {data.nearDuplicates.length} group{data.nearDuplicates.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {data.nearDuplicates.length === 0 ? (
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-sm">No near-duplicate candidates found.</span>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              These transaction groups share the same account, date, and amount but different
              remarks — they may be accidental duplicates. Review them in Transactions.
            </p>
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="pb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide pr-4">Date</th>
                  <th className="pb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide pr-4">Account</th>
                  <th className="pb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide pr-4">Amount</th>
                  <th className="pb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.nearDuplicates.map((dup, i) => (
                  <DupRow key={i} dup={dup} />
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
