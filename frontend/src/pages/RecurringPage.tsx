import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Repeat, Loader2, Calendar, TrendingDown, TrendingUp } from 'lucide-react'
import { clsx } from 'clsx'
import { getRecurring, type RecurringPattern } from '../api/recurring'
import InsightCard from '../components/InsightCard'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFull(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** "2025-04" → "Apr 2025" */
function fmtYearMonth(ym: string): string {
  const parts = ym.split('-')
  if (parts.length !== 2) return ym
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const monthIdx = Number(parts[1]) - 1
  if (monthIdx < 0 || monthIdx > 11) return ym
  return `${months[monthIdx]} ${parts[0]}`
}

// ── Lookback options ──────────────────────────────────────────────────────────

const LOOKBACK_OPTIONS = [
  { label: '6M',      months: 6,   desc: 'last 6 months' },
  { label: '12M',     months: 12,  desc: 'last 12 months' },
  { label: '24M',     months: 24,  desc: 'last 24 months' },
  { label: 'All',     months: 0,   desc: 'all available data' },
] as const

type LookbackMonths = typeof LOOKBACK_OPTIONS[number]['months']

// ── Pattern Card ──────────────────────────────────────────────────────────────

function PatternCard({ p }: { p: RecurringPattern }) {
  const isIncome = p.categoryName?.toLowerCase().includes('income') ||
                   p.categoryName?.toLowerCase().includes('salary')

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Direction icon */}
          <div className={clsx(
            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
            isIncome ? 'bg-green-50' : 'bg-blue-50'
          )}>
            {isIncome
              ? <TrendingUp className="w-4 h-4 text-green-600" />
              : <TrendingDown className="w-4 h-4 text-blue-600" />}
          </div>

          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{p.merchantName}</p>
            {p.categoryName && (
              <div className="flex items-center gap-1.5 mt-0.5">
                {p.categoryColor && (
                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: p.categoryColor }} />
                )}
                <span className="text-xs text-gray-500">{p.categoryName}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <p className="text-lg font-bold text-gray-900">{fmtFull(p.averageAmount)}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              Monthly
            </span>
            {p.activeThisMonth && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                Active
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-400 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>{p.occurrences} months detected</span>
        </div>
        <span>Last: {fmtYearMonth(p.lastMonth)}</span>
        <span>Next: {fmtYearMonth(p.nextExpected)}</span>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RecurringPage() {
  const [lookback, setLookback] = useState<LookbackMonths>(12)

  const { data, isPending, isError } = useQuery({
    queryKey: ['recurring', lookback],
    queryFn: () => getRecurring(lookback),
    staleTime: 5 * 60_000,
  })

  const lookbackDesc = LOOKBACK_OPTIONS.find(o => o.months === lookback)?.desc ?? ''

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <p className="text-red-500">Failed to load recurring patterns.</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Repeat className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Recurring Transactions</h1>
          </div>
          <p className="text-sm text-gray-500">
            {data.month} · Patterns from {lookbackDesc}
          </p>
        </div>

        {/* Lookback selector */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 self-start">
          {LOOKBACK_OPTIONS.map(opt => (
            <button
              key={opt.months}
              onClick={() => setLookback(opt.months)}
              className={clsx(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                lookback === opt.months
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Info notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
        Merchants that appeared in <strong>3 or more months</strong> with a consistent
        amount (within 20% variation) are shown here. Salary, rent, and subscription services
        are typically detected automatically.
      </div>

      {/* Main + InsightCard sidebar */}
      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 lg:items-start">
        <div>
          {/* Empty state */}
          {data.patterns.length === 0 && (
            <div className="text-center py-16">
              <Repeat className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="font-medium text-gray-500">No recurring patterns detected</p>
              <p className="text-sm text-gray-400 mt-1">
                {lookback > 0 && lookback < 12
                  ? `Try extending the window to 12M or more.`
                  : 'Import at least 3 months of statements to see patterns.'}
              </p>
            </div>
          )}

          {/* Pattern cards */}
          {data.patterns.length > 0 && (
            <>
              <p className="text-sm text-gray-500 mb-3">
                {data.patterns.length} pattern{data.patterns.length !== 1 ? 's' : ''} detected
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.patterns.map(p => (
                  <PatternCard key={`${p.merchantName}-${p.categoryName ?? 'none'}`} p={p} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* AI Insights sidebar */}
        <div className="mt-6 lg:mt-0 lg:sticky lg:top-6">
          <InsightCard type="RECURRING" label="Analyse Recurring Patterns" />
        </div>
      </div>
    </div>
  )
}
