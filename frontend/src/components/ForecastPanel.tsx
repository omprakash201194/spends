import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, ChevronDown, ChevronUp, AlertCircle, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { Link } from 'react-router-dom'
import { getMonthlyForecast, type PendingCharge } from '../api/forecast'

function inr(n: number) {
  if (n >= 100_000) return '₹' + (n / 100_000).toFixed(1) + 'L'
  if (n >= 1_000)   return '₹' + (n / 1_000).toFixed(1) + 'K'
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function inrFull(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function CategoryDot({ color }: { color: string | null }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: color ?? '#94a3b8' }}
    />
  )
}

function PendingRow({ charge }: { charge: PendingCharge }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <CategoryDot color={charge.categoryColor} />
        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{charge.merchantName}</span>
        {charge.categoryName && (
          <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500 truncate">
            {charge.categoryName}
          </span>
        )}
      </div>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200 flex-shrink-0 tabular-nums">
        {inrFull(charge.expectedAmount)}
      </span>
    </div>
  )
}

export default function ForecastPanel() {
  const [open, setOpen] = useState(true)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['forecast-monthly'],
    queryFn: getMonthlyForecast,
    staleTime: 5 * 60_000,
  })

  if (isLoading) {
    return (
      <div className="mb-4 rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/40 px-4 py-3 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" aria-hidden="true" />
        <span className="text-sm text-indigo-500 dark:text-indigo-400">Loading forecast…</span>
      </div>
    )
  }

  if (isError || !data) return null

  // No transactions at all — skip the panel
  if (data.spentSoFar === 0 && data.pendingCharges.length === 0) return null

  const pct = data.projectedTotal > 0
    ? Math.min(100, Math.round((data.spentSoFar / data.projectedTotal) * 100))
    : 100

  const progressColor = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-indigo-500'

  return (
    <div className="mb-4 rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/40 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-indigo-100/60 dark:hover:bg-indigo-900/30 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <TrendingUp className="w-4 h-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
            {data.month} forecast
          </span>
          <span className="hidden sm:inline text-xs text-indigo-400 dark:text-indigo-500">
            — as of {data.asOf}
          </span>
          {!data.dataUpToDate && (
            <span className="hidden sm:inline text-xs text-amber-600 dark:text-amber-400 font-medium">
              · data may be stale
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-200">
            {inr(data.projectedTotal)}
          </span>
          {open
            ? <ChevronUp className="w-4 h-4 text-indigo-400" aria-hidden="true" />
            : <ChevronDown className="w-4 h-4 text-indigo-400" aria-hidden="true" />
          }
        </div>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="px-4 pb-4 border-t border-indigo-100 dark:border-indigo-900/60 space-y-4 pt-3">

          {/* Stale data warning */}
          {!data.dataUpToDate && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-2">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-px" aria-hidden="true" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Your latest import is from <strong>{data.asOf}</strong>. Import a more recent statement for an accurate forecast.{' '}
                <Link to="/import" className="underline">Import now →</Link>
              </p>
            </div>
          )}

          {/* Progress bar + numbers */}
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs text-indigo-500 dark:text-indigo-400">
                Spent so far
              </span>
              <span className="text-xs text-indigo-500 dark:text-indigo-400">
                Projected total
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-indigo-200 dark:bg-indigo-900 overflow-hidden">
              <div
                className={clsx('h-full rounded-full transition-all duration-700', progressColor)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-base font-bold text-gray-800 dark:text-white">
                {inrFull(data.spentSoFar)}
              </span>
              <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                {inrFull(data.projectedTotal)}
              </span>
            </div>
            <p className="text-xs text-indigo-400 dark:text-indigo-500 mt-0.5">
              Day {data.daysElapsed} of {data.daysInMonth} · {pct}% of projected spend
            </p>
          </div>

          {/* Pending charges */}
          {data.pendingCharges.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 uppercase tracking-wide mb-2">
                +{inrFull(data.projectedAdditional)} expected from {data.pendingCharges.length} upcoming charge{data.pendingCharges.length !== 1 ? 's' : ''}
              </p>
              <div className="divide-y divide-indigo-100 dark:divide-indigo-900/50">
                {data.pendingCharges.map((c, i) => (
                  <PendingRow key={i} charge={c} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-indigo-400 dark:text-indigo-500">
              No upcoming recurring charges detected for this month.{' '}
              <Link to="/recurring" className="underline text-indigo-500 dark:text-indigo-400">
                View recurring patterns →
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
