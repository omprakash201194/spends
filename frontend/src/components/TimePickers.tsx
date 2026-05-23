import { clsx } from 'clsx'
import type { TimeAggregateResponse } from '../api/transactions'

// ── Shared button ────────────────────────────────────────────────────────────

interface PickerButtonProps {
  label: string
  total: number
  uncategorized: number
  selected?: boolean
  disabled?: boolean
  onClick: () => void
}

function PickerButton({ label, total, uncategorized, selected, disabled, onClick }: PickerButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-md border text-sm font-medium transition',
        'min-h-[44px] min-w-[44px] px-3 py-2',
        selected
          ? 'bg-blue-600 dark:bg-blue-500 border-blue-600 dark:border-blue-500 text-white'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700',
        disabled && 'opacity-40 cursor-not-allowed hover:bg-white dark:hover:bg-gray-800',
      )}
    >
      <span>{label}</span>
      <span className={clsx('text-xs', selected ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400')}>
        {total}{uncategorized > 0 ? ` (${uncategorized})` : ''}
      </span>
    </button>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// ── Composite ────────────────────────────────────────────────────────────────

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
      <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
        No transactions match your filters.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Year row */}
      <div className="flex flex-wrap gap-2">
        {data.years.map(y => (
          <PickerButton
            key={y.year}
            label={String(y.year)}
            total={y.total}
            uncategorized={y.uncategorized}
            selected={year === y.year}
            onClick={() => onYearChange(y.year)}
          />
        ))}
      </div>

      {/* Month row */}
      {year !== null && data.months && (
        <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
          {data.months.map(m => (
            <PickerButton
              key={m.month}
              label={MONTH_LABELS[m.month - 1]}
              total={m.total}
              uncategorized={m.uncategorized}
              selected={month === m.month}
              disabled={m.total === 0}
              onClick={() => onMonthChange(m.month)}
            />
          ))}
        </div>
      )}

      {/* Week row */}
      {year !== null && month !== null && data.weeks && (
        <div className="flex flex-wrap items-center gap-2">
          {data.weeks.map(w => (
            <PickerButton
              key={w.bucket}
              label={`${w.startDay}–${w.endDay}`}
              total={w.total}
              uncategorized={w.uncategorized}
              selected={weekBucket === w.bucket}
              disabled={w.total === 0}
              onClick={() => onWeekChange(weekBucket === w.bucket ? null : w.bucket)}
            />
          ))}
          {weekBucket !== null && (
            <button
              type="button"
              onClick={() => onWeekChange(null)}
              className="ml-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline underline-offset-2"
            >
              All weeks
            </button>
          )}
        </div>
      )}
    </div>
  )
}
