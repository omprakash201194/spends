import { useState } from 'react'
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
  const [tab, setTab] = useState<'configure' | 'preview'>('configure')
  const [title, setTitle] = useState(existing?.title ?? '')
  const [widgetType, setWidgetType] = useState<WidgetType>(existing?.widgetType ?? 'PIE')
  const [filterType, setFilterType] = useState<FilterType>(existing?.filterType ?? 'ALL')
  const [filterValue, setFilterValue] = useState(existing?.filterValue ?? '')
  const [metric, setMetric] = useState<Metric>(existing?.metric ?? 'SPEND')
  const [periodMonths, setPeriodMonths] = useState(existing?.periodMonths ?? 6)
  const [color, setColor] = useState(existing?.color ?? '#6366f1')

  // Preview state
  const [previewData, setPreviewData] = useState<WidgetData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  // In preview tab, user can try different chart types without committing
  const [previewWidgetType, setPreviewWidgetType] = useState<WidgetType>(existing?.widgetType ?? 'PIE')

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    staleTime: 60_000,
  })

  async function runPreview(typeOverride?: WidgetType) {
    const wt = typeOverride ?? previewWidgetType
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const result = await previewWidget({
        widgetType: wt,
        filterType,
        filterValue: filterType !== 'ALL' ? filterValue || undefined : undefined,
        metric,
        periodMonths,
        color,
      })
      setPreviewData(result)
    } catch {
      setPreviewError('Failed to load preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  function handleTabSwitch(next: 'configure' | 'preview') {
    setTab(next)
    if (next === 'preview') {
      setPreviewWidgetType(widgetType)
      runPreview(widgetType)
    }
  }

  function handlePreviewTypeChange(wt: WidgetType) {
    setPreviewWidgetType(wt)
    runPreview(wt)
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {existing ? 'Edit Widget' : 'Add Widget'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0">
          {(['configure', 'preview'] as const).map(t => (
            <button
              key={t}
              onClick={() => handleTabSwitch(t)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === t
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t === 'configure' ? 'Configure' : 'Preview'}
            </button>
          ))}
        </div>

        {/* Configure tab */}
        {tab === 'configure' && (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
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

            {/* Chart type — always visible */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Chart type</label>
              <div className="grid grid-cols-4 gap-2">
                {WIDGET_TYPES.map(wt => (
                  <button
                    key={wt.value}
                    type="button"
                    onClick={() => setWidgetType(wt.value)}
                    className={`text-center p-2 rounded-lg border text-sm transition-colors ${
                      widgetType === wt.value
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:text-gray-300'
                    }`}
                  >
                    <div className="font-medium">{wt.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{wt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Period</label>
              <div className="flex gap-2">
                {PERIOD_PRESETS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPeriodMonths(p.value)}
                    className={`flex-1 py-1.5 text-sm rounded-lg border font-medium transition-colors ${
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
        )}

        {/* Preview tab */}
        {tab === 'preview' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Chart type switcher — try different types without committing */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Try a different chart type
              </label>
              <div className="grid grid-cols-4 gap-2">
                {WIDGET_TYPES.map(wt => (
                  <button
                    key={wt.value}
                    type="button"
                    onClick={() => handlePreviewTypeChange(wt.value)}
                    className={`text-center p-2 rounded-lg border text-sm transition-colors ${
                      previewWidgetType === wt.value
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:text-gray-300'
                    }`}
                  >
                    <div className="font-medium">{wt.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{wt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview area */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 min-h-48">
              {previewLoading && (
                <div className="h-40 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {previewError && !previewLoading && (
                <div className="h-40 flex flex-col items-center justify-center gap-3 text-sm text-red-500">
                  <span>{previewError}</span>
                  <button
                    onClick={() => runPreview()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-300 rounded-lg hover:bg-red-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                  </button>
                </div>
              )}
              {previewData && !previewLoading && (
                <WidgetRenderer
                  data={{ ...previewData, widgetType: previewWidgetType }}
                  color={color}
                />
              )}
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500">
              Preview uses your current filter, metric, and period settings. Switch chart types here to see what suits your data best — your selection on the Configure tab is what gets saved.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setTab('configure')}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Back to Configure
              </button>
              <button
                onClick={e => { e.preventDefault(); onSave({ title, widgetType, filterType, filterValue: filterType !== 'ALL' ? filterValue || undefined : undefined, metric, periodMonths, color }) }}
                className="flex-1 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"
              >
                {existing ? 'Save changes' : 'Add widget'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
