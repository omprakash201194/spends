import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, RefreshCw } from 'lucide-react'
import { getCategories } from '../api/categories'
import {
  previewWidget,
  type CreateWidgetRequest, type FilterType, type Metric,
  type Widget, type WidgetData, type WidgetType, type UpdateWidgetRequest,
} from '../api/widgets'
import WidgetRenderer from './WidgetRenderer'

const WIDGET_TYPES: { value: WidgetType; label: string; desc: string }[] = [
  { value: 'PIE',  label: 'Pie',  desc: 'Category slices' },
  { value: 'BAR',  label: 'Bar',  desc: 'Category bars' },
  { value: 'LINE', label: 'Line', desc: 'Trend over time' },
  { value: 'STAT', label: 'Stat', desc: 'Single total' },
]

const FILTER_TYPES: { value: FilterType; label: string }[] = [
  { value: 'ALL',      label: 'All transactions' },
  { value: 'CATEGORY', label: 'Category (+ subcategories)' },
  { value: 'TAG',      label: 'Tag / keyword' },
]

const METRICS: { value: Metric; label: string }[] = [
  { value: 'SPEND',  label: 'Total Spend' },
  { value: 'INCOME', label: 'Total Income' },
  { value: 'COUNT',  label: 'Transaction Count' },
]

const PERIOD_PRESETS = [
  { label: '3m',  value: 3 },
  { label: '6m',  value: 6 },
  { label: '12m', value: 12 },
  { label: '24m', value: 24 },
  { label: 'All', value: 0 },
]

const PRESET_COLORS = [
  '#6366f1', '#f97316', '#22c55e', '#ef4444',
  '#3b82f6', '#a855f7', '#14b8a6', '#eab308',
]

interface Props {
  dashboardId: string
  existing?: Widget
  onSave: (req: CreateWidgetRequest & UpdateWidgetRequest) => void
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

  // Preview panel — independent chart type so user can try alternatives without affecting save
  const [previewWidgetType, setPreviewWidgetType] = useState<WidgetType>(existing?.widgetType ?? 'PIE')
  const [previewData, setPreviewData] = useState<WidgetData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    staleTime: 60_000,
  })

  async function runPreview(wt: WidgetType, ft: FilterType, fv: string, m: Metric, pm: number, c: string) {
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const result = await previewWidget({
        widgetType: wt,
        filterType: ft,
        filterValue: ft !== 'ALL' ? fv || undefined : undefined,
        metric: m,
        periodMonths: pm,
        color: c,
      })
      setPreviewData(result)
    } catch {
      setPreviewError('Failed to load preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  // Auto-refresh preview (debounced 600ms) whenever any config param changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runPreview(previewWidgetType, filterType, filterValue, metric, periodMonths, color)
    }, 600)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewWidgetType, filterType, filterValue, metric, periodMonths, color])

  // When user changes the configure chart type, sync preview type too
  function handleWidgetTypeChange(wt: WidgetType) {
    setWidgetType(wt)
    setPreviewWidgetType(wt)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      title,
      widgetType,
      filterType,
      filterValue: filterType !== 'ALL' ? filterValue || undefined : undefined,
      metric,
      periodMonths,
      color,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {existing ? 'Edit Widget' : 'Add Widget'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — two columns */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left: Configure */}
          <form
            id="widget-form"
            onSubmit={handleSubmit}
            className="w-80 shrink-0 overflow-y-auto border-r border-gray-200 dark:border-gray-700 p-5 space-y-4"
          >
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Title</label>
              <input
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="My spending breakdown"
              />
            </div>

            {/* Chart type */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Chart type</label>
              <div className="grid grid-cols-4 gap-1.5">
                {WIDGET_TYPES.map(wt => (
                  <button
                    key={wt.value}
                    type="button"
                    onClick={() => handleWidgetTypeChange(wt.value)}
                    className={`text-center px-1.5 py-2 rounded-lg border text-xs transition-colors ${
                      widgetType === wt.value
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:text-gray-300'
                    }`}
                  >
                    <div className="font-semibold">{wt.label}</div>
                    <div className="text-gray-400 dark:text-gray-500 mt-0.5 leading-tight" style={{ fontSize: '10px' }}>{wt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Metric */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Metric</label>
              <select
                value={metric}
                onChange={e => setMetric(e.target.value as Metric)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            {/* Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Filter</label>
              <select
                value={filterType}
                onChange={e => { setFilterType(e.target.value as FilterType); setFilterValue('') }}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {FILTER_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
              </select>
            </div>

            {filterType === 'CATEGORY' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Category</label>
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
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Tag / keyword</label>
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
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Period</label>
              <div className="flex gap-1.5">
                {PERIOD_PRESETS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPeriodMonths(p.value)}
                    className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                      periodMonths === p.value
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Accent color</label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </form>

          {/* Right: Preview */}
          <div className="flex-1 flex flex-col overflow-hidden p-5 gap-4">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Preview</span>
              <div className="flex items-center gap-2">
                {previewLoading && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">Updating…</span>
                )}
                <button
                  type="button"
                  onClick={() => runPreview(previewWidgetType, filterType, filterValue, metric, periodMonths, color)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Refresh preview"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${previewLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Chart type switcher — try without committing */}
            <div className="shrink-0">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">Try a different chart type in preview</p>
              <div className="flex gap-1.5">
                {WIDGET_TYPES.map(wt => (
                  <button
                    key={wt.value}
                    type="button"
                    onClick={() => setPreviewWidgetType(wt.value)}
                    className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                      previewWidgetType === wt.value
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    {wt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart area */}
            <div className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
              {previewError && !previewLoading && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-red-500">
                  <span>{previewError}</span>
                  <button
                    type="button"
                    onClick={() => runPreview(previewWidgetType, filterType, filterValue, metric, periodMonths, color)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-300 rounded-lg hover:bg-red-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                  </button>
                </div>
              )}
              {!previewError && (
                <div className={`flex-1 p-4 transition-opacity ${previewLoading ? 'opacity-40' : 'opacity-100'}`}>
                  {previewData ? (
                    <WidgetRenderer
                      data={{ ...previewData, widgetType: previewWidgetType }}
                      color={color}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
                      Loading preview…
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
              Preview chart type is independent — the type selected on the left is what gets saved.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="widget-form"
            className="flex-1 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"
          >
            {existing ? 'Save changes' : 'Add widget'}
          </button>
        </div>
      </div>
    </div>
  )
}
