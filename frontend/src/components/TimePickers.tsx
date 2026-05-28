import { clsx } from 'clsx'
import type { MonthAgg, TimeAggregateResponse, WeekAgg, YearAgg } from '../api/transactions'

// ── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_FULL   = ['January','February','March','April','May','June','July','August','September','October','November','December']

function inr(n: number) {
  if (n === 0) return '₹0'
  if (n >= 100_000) return '₹' + (n / 100_000).toFixed(1) + 'L'
  if (n >= 1_000)   return '₹' + (n / 1_000).toFixed(1) + 'K'
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

// ── Year pill ─────────────────────────────────────────────────────────────────

function YearPill({ y, selected, onClick }: { y: YearAgg; selected: boolean; onClick: () => void }) {
  const hasDebit  = y.debit  > 0
  const hasCredit = y.credit > 0
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-all',
        selected
          ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-600'
      )}
    >
      <span className="font-semibold">{y.year}</span>
      {hasDebit && (
        <span className={clsx('text-xs', selected ? 'text-red-100' : 'text-red-500 dark:text-red-400')}>
          −{inr(y.debit)}
        </span>
      )}
      {hasCredit && (
        <span className={clsx('text-xs', selected ? 'text-emerald-100' : 'text-emerald-600 dark:text-emerald-400')}>
          +{inr(y.credit)}
        </span>
      )}
    </button>
  )
}

// ── Month card ────────────────────────────────────────────────────────────────

function MonthCard({
  m, selected, maxAmount, onClick,
}: { m: MonthAgg; selected: boolean; maxAmount: number; onClick: () => void }) {
  const isEmpty   = m.total === 0
  const totalAmt  = m.debit + m.credit
  const barPct    = maxAmount > 0 ? Math.max(2, (totalAmt / maxAmount) * 100) : 0
  const hasUncat  = m.uncategorized > 0
  const hasDebit  = m.debit  > 0
  const hasCredit = m.credit > 0

  return (
    <button
      type="button"
      disabled={isEmpty}
      onClick={onClick}
      className={clsx(
        'relative flex flex-col items-start rounded-xl border-2 p-3 text-left transition-all duration-150',
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 shadow-sm'
          : isEmpty
            ? 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 opacity-40 cursor-not-allowed'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm cursor-pointer',
      )}
    >
      {/* Uncategorized dot */}
      {hasUncat && !isEmpty && (
        <span
          className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-400"
          title={`${m.uncategorized} uncategorized`}
        />
      )}

      {/* Month label */}
      <span className={clsx(
        'text-xs font-semibold mb-1',
        selected ? 'text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400',
      )}>
        {MONTH_LABELS[m.month - 1]}
      </span>

      {/* Debit amount */}
      {hasDebit && (
        <span className={clsx(
          'text-sm font-bold leading-tight',
          'text-red-600 dark:text-red-400',
        )}>
          −{inr(m.debit)}
        </span>
      )}

      {/* Credit amount */}
      {hasCredit && (
        <span className={clsx(
          'text-sm font-bold leading-tight',
          'text-emerald-600 dark:text-emerald-400',
        )}>
          +{inr(m.credit)}
        </span>
      )}

      {/* Empty placeholder */}
      {isEmpty && (
        <span className="text-base font-bold leading-tight text-gray-300 dark:text-gray-600">
          —
        </span>
      )}

      {/* Transaction count */}
      <span className={clsx(
        'text-[11px] mt-0.5',
        selected ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500',
      )}>
        {isEmpty ? 'no data' : `${m.total} tx`}
      </span>

      {/* Total spend bar */}
      {!isEmpty && (
        <div className="mt-2 w-full h-1 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-500',
              selected ? 'bg-blue-500' : 'bg-indigo-400 dark:bg-indigo-500',
            )}
            style={{ width: `${barPct}%` }}
          />
        </div>
      )}
    </button>
  )
}

// ── Week card ─────────────────────────────────────────────────────────────────

function WeekCard({
  w, selected, maxAmount, onClick,
}: { w: WeekAgg; selected: boolean; maxAmount: number; onClick: () => void }) {
  const isEmpty   = w.total === 0
  const totalAmt  = w.debit + w.credit
  const barPct    = maxAmount > 0 ? Math.max(2, (totalAmt / maxAmount) * 100) : 0
  const hasUncat  = w.uncategorized > 0
  const hasDebit  = w.debit  > 0
  const hasCredit = w.credit > 0

  return (
    <button
      type="button"
      disabled={isEmpty}
      onClick={onClick}
      className={clsx(
        'relative flex flex-col items-start rounded-xl border-2 px-3 py-2.5 text-left transition-all duration-150 min-w-[88px]',
        selected
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 shadow-sm'
          : isEmpty
            ? 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 opacity-40 cursor-not-allowed'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm cursor-pointer',
      )}
    >
      {hasUncat && !isEmpty && (
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
      )}

      <span className={clsx(
        'text-xs font-semibold',
        selected ? 'text-indigo-600 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400',
      )}>
        {w.startDay}–{w.endDay}
      </span>

      {hasDebit && (
        <span className="text-xs font-bold mt-0.5 text-red-600 dark:text-red-400">
          −{inr(w.debit)}
        </span>
      )}
      {hasCredit && (
        <span className="text-xs font-bold mt-0.5 text-emerald-600 dark:text-emerald-400">
          +{inr(w.credit)}
        </span>
      )}
      {isEmpty && (
        <span className="text-sm font-bold mt-0.5 text-gray-300 dark:text-gray-600">—</span>
      )}

      <span className="text-[11px] text-gray-400 dark:text-gray-500">
        {isEmpty ? '' : `${w.total} tx`}
      </span>

      {!isEmpty && (
        <div className="mt-1.5 w-full h-1 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div
            className={clsx('h-full rounded-full', selected ? 'bg-indigo-500' : 'bg-violet-400 dark:bg-violet-500')}
            style={{ width: `${barPct}%` }}
          />
        </div>
      )}
    </button>
  )
}

// ── Composite ─────────────────────────────────────────────────────────────────

interface TimePickersProps {
  data: TimeAggregateResponse | undefined
  year: number | null
  month: number | null
  weekBucket: number | null
  onYearChange: (year: number) => void
  onMonthChange: (month: number) => void
  onWeekChange: (bucket: number | null) => void
}

export function TimePickers({
  data,
  year, month, weekBucket,
  onYearChange, onMonthChange, onWeekChange,
}: TimePickersProps) {
  if (!data || data.years.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
        No transactions match your filters.
      </div>
    )
  }

  const maxMonthAmount = data.months
    ? Math.max(...data.months.map(m => m.debit + m.credit), 0)
    : 0

  const maxWeekAmount = data.weeks
    ? Math.max(...data.weeks.map(w => w.debit + w.credit), 0)
    : 0

  const selectedMonthLabel = month != null ? MONTH_FULL[month - 1] : null

  return (
    <div className="space-y-4">
      {/* ── Year row ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {data.years.map(y => (
          <YearPill
            key={y.year}
            y={y}
            selected={year === y.year}
            onClick={() => onYearChange(y.year)}
          />
        ))}
      </div>

      {/* ── Month grid ──────────────────────────────────────────────────── */}
      {year !== null && data.months && (
        <div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
            {data.months.map(m => (
              <MonthCard
                key={m.month}
                m={m}
                selected={month === m.month}
                maxAmount={maxMonthAmount}
                onClick={() => onMonthChange(m.month)}
              />
            ))}
          </div>

          {/* Amber dot legend — only if any month has uncategorized */}
          {data.months.some(m => m.uncategorized > 0) && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              Month has uncategorized transactions
            </p>
          )}
        </div>
      )}

      {/* ── Week row ────────────────────────────────────────────────────── */}
      {year !== null && month !== null && data.weeks && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {selectedMonthLabel} {year} — weeks
            </span>
            {weekBucket !== null && (
              <button
                type="button"
                onClick={() => onWeekChange(null)}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline underline-offset-2"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {data.weeks.map(w => (
              <WeekCard
                key={w.bucket}
                w={w}
                selected={weekBucket === w.bucket}
                maxAmount={maxWeekAmount}
                onClick={() => onWeekChange(weekBucket === w.bucket ? null : w.bucket)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
