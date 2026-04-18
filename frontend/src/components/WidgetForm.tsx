import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { getCategories } from '../api/categories'
import type { CreateWidgetRequest, FilterType, Metric, Widget, WidgetType } from '../api/widgets'

const WIDGET_TYPES: { value: WidgetType; label: string; desc: string }[] = [
  { value: 'PIE',  label: 'Pie Chart',  desc: 'Category breakdown as slices' },
  { value: 'BAR',  label: 'Bar Chart',  desc: 'Category comparison as bars' },
  { value: 'LINE', label: 'Line Chart', desc: 'Spending trend over time' },
  { value: 'STAT', label: 'Stat',       desc: 'Single total number' },
]

const FILTER_TYPES: { value: FilterType; label: string }[] = [
  { value: 'ALL',      label: 'All transactions' },
  { value: 'CATEGORY', label: 'Category (+ subcategories)' },
  { value: 'TAG',      label: 'Tag / keyword in remarks' },
]

const METRICS: { value: Metric; label: string }[] = [
  { value: 'SPEND',  label: 'Total Spend' },
  { value: 'INCOME', label: 'Total Income' },
  { value: 'COUNT',  label: 'Transaction Count' },
]

const PRESET_COLORS = [
  '#6366f1', '#f97316', '#22c55e', '#ef4444',
  '#3b82f6', '#a855f7', '#14b8a6', '#eab308',
]

interface Props {
  existing?: Widget
  onSave: (req: CreateWidgetRequest) => void
  onClose: () => void
}

export default function WidgetForm({ existing, onSave, onClose }: Props) {
  const [title, setTitle] = useState(existing?.title ?? '')
  const [widgetType, setWidgetType] = useState<WidgetType>(existing?.widgetType ?? 'PIE')
  const [filterType, setFilterType] = useState<FilterType>(existing?.filterType ?? 'ALL')
  const [filterValue, setFilterValue] = useState(existing?.filterValue ?? '')
  const [metric, setMetric] = useState<Metric>(existing?.metric ?? 'SPEND')
  const [periodMonths, setPeriodMonths] = useState(existing?.periodMonths ?? 6)
  const [color, setColor] = useState(existing?.color ?? '#6366f1')

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    staleTime: 60_000,
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      title,
      widgetType,
      filterType,
      filterValue: filterType !== 'ALL' ? filterValue : undefined,
      metric,
      periodMonths,
      color,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {existing ? 'Edit Widget' : 'Add Widget'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="My spending breakdown"
            />
          </div>

          {/* Widget type (only shown when creating) */}
          {!existing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Chart type</label>
              <div className="grid grid-cols-2 gap-2">
                {WIDGET_TYPES.map(wt => (
                  <button
                    key={wt.value}
                    type="button"
                    onClick={() => setWidgetType(wt.value)}
                    className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                      widgetType === wt.value
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:text-gray-300'
                    }`}
                  >
                    <div className="font-medium">{wt.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{wt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Metric */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Metric</label>
            <select
              value={metric}
              onChange={e => setMetric(e.target.value as Metric)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {/* Filter type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Filter</label>
            <select
              value={filterType}
              onChange={e => { setFilterType(e.target.value as FilterType); setFilterValue('') }}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {FILTER_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
            </select>
          </div>

          {/* Filter value */}
          {filterType === 'CATEGORY' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <select
                value={filterValue}
                onChange={e => setFilterValue(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">— pick category —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {filterType === 'TAG' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tag / keyword</label>
              <input
                value={filterValue}
                onChange={e => setFilterValue(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g. Goa trip"
              />
            </div>
          )}

          {/* Period */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Period: last {periodMonths} month{periodMonths !== 1 ? 's' : ''}
            </label>
            <input
              type="range"
              min={1} max={24} step={1}
              value={periodMonths}
              onChange={e => setPeriodMonths(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1m</span><span>6m</span><span>12m</span><span>24m</span>
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Accent color</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium">
              {existing ? 'Save changes' : 'Add widget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
