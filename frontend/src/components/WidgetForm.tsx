import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, RefreshCw } from 'lucide-react'
import { getCategories } from '../api/categories'
import { getBankAccounts } from '../api/bankAccounts'
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
  const [accountId, setAccountId] = useState(existing?.accountId ?? '')
  const [customFrom, setCustomFrom] = useState(existing?.customFrom ?? '')
  const [customTo, setCustomTo] = useState(existing?.customTo ?? '')
  const [customPopoverOpen, setCustomPopoverOpen] = useState(false)
  const [customError, setCustomError] = useState<string | null>(null)

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

  const { data: accounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: getBankAccounts,
    staleTime: Infinity,
  })

  async function runPreview(wt: WidgetType, ft: FilterType, fv: string, m: Metric, pm: number, c: string,
                            acc: string, cf: string, ct: string) {
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
        accountId: acc || undefined,
        customFrom: cf || undefined,
        customTo: ct || undefined,
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
      runPreview(previewWidgetType, filterType, filterValue, metric, periodMonths, color, accountId, customFrom, customTo)
    }, 600)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewWidgetType, filterType, filterValue, metric, periodMonths, color, accountId, customFrom, customTo])

  // When user changes the configure chart type, sync preview type too
  function handleWidgetTypeChange(wt: WidgetType) {
    setWidgetType(wt)
    setPreviewWidgetType(wt)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCustomError(null)
    if (customTo && !customFrom) {
      setCustomError('Set a "From" date to use a custom range')
      return
    }
    if (customFrom && customTo && customFrom > customTo) {
      setCustomError('"From" must be on or before "To"')
      return
    }
    onSave({
      title,
      widgetType,
      filterType,
      filterValue: filterType !== 'ALL' ? filterValue || undefined : undefined,
      metric,
      periodMonths,
      color,
      accountId: accountId || undefined,
      customFrom: customFrom || undefined,
      customTo: customTo || undefined,
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

            {/* Account */}
            {accounts.length > 1 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Account</label>
                <select
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">All accounts</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.bankName} {a.accountNumberMasked ?? ''}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Period */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Period</label>
              <div className="flex gap-1.5 flex-wrap relative">
                {PERIOD_PRESETS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      setPeriodMonths(p.value)
                      setCustomFrom('')
                      setCustomTo('')
                      setCustomPopoverOpen(false)
                    }}
                    className={`flex-1 min-w-[40px] py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                      !customFrom && periodMonths === p.value
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCustomPopoverOpen(!customPopoverOpen)}
                  className={`flex-1 min-w-[80px] py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                    customFrom
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {customFrom
                    ? `${customFrom} → ${customTo || 'today'}`
                    : 'Custom ▾'}
                </button>

                {customPopoverOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 z-10 p-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg space-y-2">
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">From</label>
                      <input
                        type="date"
                        value={customFrom}
                        onChange={e => setCustomFrom(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">To (optional, defaults to today)</label>
                      <input
                        type="date"
                        value={customTo}
                        onChange={e => setCustomTo(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => { setCustomFrom(''); setCustomTo(''); setCustomPopoverOpen(false) }}
                        className="flex-1 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        disabled={!customFrom}
                        onClick={() => setCustomPopoverOpen(false)}
                        className="flex-1 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
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

            {customError && (
              <div className="text-xs text-red-500">{customError}</div>
            )}
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
                  onClick={() => runPreview(previewWidgetType, filterType, filterValue, metric, periodMonths, color, accountId, customFrom, customTo)}
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
                    onClick={() => runPreview(previewWidgetType, filterType, filterValue, metric, periodMonths, color, accountId, customFrom, customTo)}
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
