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
      <span className={clsx('text-xs', selected ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500')}>
        {inr(y.spent)}
      </span>
    </button>
  )
}

// ── Month card ────────────────────────────────────────────────────────────────

function MonthCard({
  m, selected, maxSpent, onClick,
}: { m: MonthAgg; selected: boolean; maxSpent: number; onClick: () => void }) {
  const isEmpty   = m.total === 0
  const barPct    = maxSpent > 0 ? Math.max(2, (m.spent / maxSpent) * 100) : 0
  const hasUncat  = m.uncategorized > 0

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

      {/* Spend amount */}
      <span className={clsx(
        'text-base font-bold leading-tight',
        selected
          ? 'text-blue-700 dark:text-blue-200'
          : isEmpty ? 'text-gray-300 dark:text-gray-600' : 'text-gray-900 dark:text-white',
      )}>
        {isEmpty ? '—' : inr(m.spent)}
      </span>

      {/* Transaction count */}
      <span className={clsx(
        'text-[11px] mt-0.5',
        selected ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500',
      )}>
        {isEmpty ? 'no data' : `${m.total} tx`}
      </span>

      {/* Spend bar */}
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
  w, selected, maxSpent, onClick,
}: { w: WeekAgg; selected: boolean; maxSpent: number; onClick: () => void }) {
  const isEmpty  = w.total === 0
  const barPct   = maxSpent > 0 ? Math.max(2, (w.spent / maxSpent) * 100) : 0
  const hasUncat = w.uncategorized > 0

  return (
    <button
      type="button"
      disabled={isEmpty}
      onClick={onClick}
      className={clsx(
        'relative flex flex-col items-start rounded-xl border-2 px-3 py-2.5 text-left transition-all duration-150 min-w-[80px]',
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

      <span className={clsx(
        'text-sm font-bold mt-0.5',
        selected ? 'text-indigo-700 dark:text-indigo-200' : 'text-gray-900 dark:text-white',
      )}>
        {isEmpty ? '—' : inr(w.spent)}
      </span>

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

  const maxMonthSpent = data.months
    ? Math.max(...data.months.map(m => m.spent), 0)
    : 0

  const maxWeekSpent = data.weeks
    ? Math.max(...data.weeks.map(w => w.spent), 0)
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
        {year !== null && (
          <button
            type="button"
            onClick={() => { onYearChange(year) }}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline underline-offset-2 ml-1"
            title="Showing all months for this year"
          >
            {year}
          </button>
        )}
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
                maxSpent={maxMonthSpent}
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
                maxSpent={maxWeekSpent}
                onClick={() => onWeekChange(weekBucket === w.bucket ? null : w.bucket)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
