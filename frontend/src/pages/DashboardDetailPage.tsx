import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, Copy, ArrowLeft, LayoutGrid,
} from 'lucide-react'
import { Responsive, WidthProvider, type LayoutItem } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import {
  getWidgets, createWidget, updateWidget, deleteWidget, getWidgetData,
  duplicateWidget, applyLayout,
  type Widget, type CreateWidgetRequest, type UpdateWidgetRequest,
  type DataSlice, type DataPoint,
} from '../api/widgets'
import {
  getDashboard, updateDashboardFilters, duplicateDashboard,
  type Dashboard,
} from '../api/dashboards'
import { getBankAccounts } from '../api/bankAccounts'
import WidgetForm from '../components/WidgetForm'
import WidgetRenderer from '../components/WidgetRenderer'

const ResponsiveGridLayout = WidthProvider(Responsive)

const PERIOD_PRESETS = [
  { label: '3m', value: 3 },
  { label: '6m', value: 6 },
  { label: '12m', value: 12 },
  { label: '24m', value: 24 },
  { label: 'All', value: 0 },
]

// ── Date helpers used to translate effective dashboard/widget filters into URL params ─
function isoDate(d: Date): string { return d.toISOString().slice(0, 10) }
function todayIso(): string { return isoDate(new Date()) }
function firstOfMonthMonthsAgo(n: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  d.setDate(1)
  return isoDate(d)
}

/** Build /transactions URL preserving the effective dashboard+widget filter for chart click-through. */
function buildTxUrl(
  widget: Widget,
  dashboard: Dashboard | undefined,
  opts: { slice?: DataSlice; point?: DataPoint } = {}
): string {
  const dashAccount    = dashboard?.accountId ?? null
  const dashCustomFrom = dashboard?.customFrom ?? null
  const dashCustomTo   = dashboard?.customTo ?? null
  const dashPeriod     = dashboard?.periodMonths ?? null

  const effAccountId = dashAccount || widget.accountId

  let dateFrom: string | null = null
  let dateTo:   string | null = null

  if (dashCustomFrom) {
    dateFrom = dashCustomFrom
    dateTo   = dashCustomTo || todayIso()
  } else if (dashPeriod !== null) {
    if (dashPeriod !== 0) {
      dateFrom = firstOfMonthMonthsAgo(dashPeriod)
      dateTo   = todayIso()
    }
  } else if (widget.customFrom) {
    dateFrom = widget.customFrom
    dateTo   = widget.customTo || todayIso()
  } else if (widget.periodMonths !== 0) {
    dateFrom = firstOfMonthMonthsAgo(widget.periodMonths)
    dateTo   = todayIso()
  }

  // LINE point click narrows to that single month
  if (opts.point) {
    const [y, m] = opts.point.month.split('-').map(Number)
    const start  = new Date(y, m - 1, 1)
    const end    = new Date(y, m, 0)  // last day of month
    dateFrom = isoDate(start)
    dateTo   = isoDate(end)
  }

  let categoryId: string | null = null
  if (opts.slice?.categoryId) {
    categoryId = opts.slice.categoryId
  } else if (widget.filterType === 'CATEGORY' && widget.filterValue) {
    categoryId = widget.filterValue
  }

  const params = new URLSearchParams()
  if (dateFrom)    params.set('dateFrom',   dateFrom)
  if (dateTo)      params.set('dateTo',     dateTo)
  if (categoryId)  params.set('categoryId', categoryId)
  if (effAccountId) params.set('accountId', effAccountId)
  if (widget.metric === 'SPEND')       params.set('type', 'DEBIT')
  else if (widget.metric === 'INCOME') params.set('type', 'CREDIT')

  return `/transactions?${params.toString()}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter bar — renders dashboard-level account + period + custom range controls
// ─────────────────────────────────────────────────────────────────────────────

function FilterBar({ dashboard, dashboardId }: { dashboard: Dashboard; dashboardId: string }) {
  const queryClient = useQueryClient()
  const { data: accounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: getBankAccounts,
    staleTime: Infinity,
  })

  const [customOpen, setCustomOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState(dashboard.customFrom ?? '')
  const [customTo, setCustomTo]     = useState(dashboard.customTo ?? '')

  // Keep local state in sync if dashboard changes (after duplicate, etc.)
  useEffect(() => {
    setCustomFrom(dashboard.customFrom ?? '')
    setCustomTo(dashboard.customTo ?? '')
  }, [dashboard.customFrom, dashboard.customTo])

  const filterMut = useMutation({
    mutationFn: (filters: { accountId?: string | null; periodMonths?: number | null; customFrom?: string | null; customTo?: string | null }) =>
      updateDashboardFilters(dashboardId, filters),
    onSuccess: () => {
      // Invalidate both the dashboard itself and all widget data queries — they need to refetch
      queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] })
      queryClient.invalidateQueries({ queryKey: ['widget-data'] })
    },
  })

  function clearFilters() {
    setCustomFrom(''); setCustomTo('')
    filterMut.mutate({ accountId: null, periodMonths: null, customFrom: null, customTo: null })
  }

  function pickPeriod(months: number | null) {
    setCustomFrom(''); setCustomTo('')
    filterMut.mutate({
      accountId: dashboard.accountId,
      periodMonths: months,
      customFrom: null,
      customTo: null,
    })
  }

  function pickAccount(accountId: string) {
    filterMut.mutate({
      accountId: accountId || null,
      periodMonths: dashboard.periodMonths,
      customFrom: dashboard.customFrom,
      customTo: dashboard.customTo,
    })
  }

  function applyCustomRange() {
    filterMut.mutate({
      accountId: dashboard.accountId,
      periodMonths: null,
      customFrom: customFrom || null,
      customTo: customTo || null,
    })
    setCustomOpen(false)
  }

  const hasAnyFilter = dashboard.accountId || dashboard.periodMonths !== null || dashboard.customFrom

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mr-2">
          Filters
        </span>

        {/* Account */}
        {accounts.length > 1 && (
          <select
            value={dashboard.accountId ?? ''}
            onChange={e => pickAccount(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All accounts</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.bankName} {a.accountNumberMasked ?? ''}</option>
            ))}
          </select>
        )}

        {/* Period presets */}
        <div className="flex gap-1.5">
          {PERIOD_PRESETS.map(p => (
            <button
              key={p.value}
              onClick={() => pickPeriod(p.value)}
              className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                !dashboard.customFrom && dashboard.periodMonths === p.value
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
              }`}
            >
              {p.label}
            </button>
          ))}
          <div className="relative">
            <button
              onClick={() => setCustomOpen(v => !v)}
              className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                dashboard.customFrom
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
              }`}
            >
              {dashboard.customFrom ? `${dashboard.customFrom} → ${dashboard.customTo || 'today'}` : 'Custom ▾'}
            </button>
            {customOpen && (
              <div className="absolute top-full left-0 mt-2 z-20 p-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg space-y-2 w-64">
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
                  <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">To (optional)</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={e => setCustomTo(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setCustomOpen(false)}
                    className="flex-1 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!customFrom}
                    onClick={applyCustomRange}
                    className="flex-1 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {hasAnyFilter && (
          <button
            onClick={clearFilters}
            className="ml-auto text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
          >
            Clear
          </button>
        )}
      </div>
      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">
        Dashboard filters override per-widget filters when set. Saved automatically.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Widget card
// ─────────────────────────────────────────────────────────────────────────────

function WidgetCard({
  widget, dashboard, onEdit, onDelete, onDuplicate,
}: {
  widget: Widget
  dashboard: Dashboard | undefined
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['widget-data', widget.id],
    queryFn: () => getWidgetData(widget.id),
    staleTime: 60_000,
  })

  function handleSliceClick(slice: DataSlice) {
    navigate(buildTxUrl(widget, dashboard, { slice }))
  }
  function handlePointClick(point: DataPoint) {
    navigate(buildTxUrl(widget, dashboard, { point }))
  }
  function handleStatClick() {
    navigate(buildTxUrl(widget, dashboard, {}))
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 h-full flex flex-col">
      {/* Drag handle area — title + actions; the chart itself is non-draggable */}
      <div className="widget-drag-handle flex items-center justify-between mb-3 cursor-move">
        <h3 className="font-medium text-gray-900 dark:text-white text-sm truncate flex-1">{widget.title}</h3>
        <div className="flex gap-1 flex-shrink-0" onMouseDown={e => e.stopPropagation()}>
          <button
            onClick={onDuplicate}
            title="Duplicate widget"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onEdit}
            title="Edit"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {isLoading && (
          <div className="h-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {isError && (
          <div className="h-full flex items-center justify-center text-sm text-red-500">
            Failed to load data
          </div>
        )}
        {data && (
          <WidgetRenderer
            data={data}
            color={widget.color}
            onSliceClick={handleSliceClick}
            onPointClick={handlePointClick}
            onStatClick={handleStatClick}
          />
        )}
      </div>

      <div className="mt-2 flex gap-1.5 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
          {widget.widgetType}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
          {widget.customFrom
            ? `${widget.customFrom} → ${widget.customTo || 'today'}`
            : widget.periodMonths === 0
              ? 'All time'
              : `${widget.periodMonths}m`}
        </span>
        {widget.filterType !== 'ALL' && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300">
            {widget.filterType}
          </span>
        )}
        {widget.accountId && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300">
            account
          </span>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardDetailPage() {
  const { id: dashboardId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Widget | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard', dashboardId],
    queryFn: () => getDashboard(dashboardId!),
    enabled: !!dashboardId,
    staleTime: 30_000,
  })

  const { data: widgets = [], isLoading } = useQuery({
    queryKey: ['widgets', dashboardId],
    queryFn: () => getWidgets(dashboardId!),
    enabled: !!dashboardId,
    staleTime: 30_000,
  })

  const createMut = useMutation({
    mutationFn: (req: CreateWidgetRequest) => createWidget(dashboardId!, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets', dashboardId] })
      setShowForm(false)
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, req }: { id: string; req: UpdateWidgetRequest }) => updateWidget(id, req),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['widgets', dashboardId] })
      queryClient.invalidateQueries({ queryKey: ['widget-data', id] })
      setEditing(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: deleteWidget,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['widgets', dashboardId] })
      queryClient.removeQueries({ queryKey: ['widget-data', id] })
      setDeletingId(null)
    },
  })

  const duplicateWidgetMut = useMutation({
    mutationFn: duplicateWidget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets', dashboardId] })
    },
  })

  const duplicateDashboardMut = useMutation({
    mutationFn: () => duplicateDashboard(dashboardId!),
    onSuccess: (newDash) => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] })
      navigate(`/dashboards/${newDash.id}`)
    },
  })

  // ── Layout persistence (drag/resize) ────────────────────────────────────────
  // RGL fires onLayoutChange on mount with the provided layout. Skip the first
  // fire so we don't immediately POST identical coordinates back.
  const layoutInitRef = useRef(true)
  const layoutSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSentRef = useRef<string>('')

  function onLayoutChange(layout: readonly LayoutItem[]) {
    if (layoutInitRef.current) {
      layoutInitRef.current = false
      return
    }
    // Serialize for diff to avoid redundant requests
    const sig = layout
      .map(l => `${l.i}:${l.x}:${l.y}:${l.w}:${l.h}`)
      .sort()
      .join('|')
    if (sig === lastSentRef.current) return
    lastSentRef.current = sig

    if (layoutSaveTimerRef.current) clearTimeout(layoutSaveTimerRef.current)
    layoutSaveTimerRef.current = setTimeout(() => {
      const items = layout.map(l => ({
        id: l.i,
        gridX: l.x,
        gridY: l.y,
        gridW: l.w,
        gridH: l.h,
      }))
      applyLayout(items).catch(() => {
        // If save fails, allow another retry on next change
        lastSentRef.current = ''
      })
    }, 500)
  }

  // Reset layout init flag whenever the dashboard or widget set changes (eg. dup, navigation)
  useEffect(() => {
    layoutInitRef.current = true
    lastSentRef.current = ''
  }, [dashboardId, widgets.length])

  const rglLayout: LayoutItem[] = widgets.map(w => ({
    i: w.id,
    x: w.gridX,
    y: w.gridY,
    w: w.gridW,
    h: w.gridH,
    minW: 2,
    minH: 2,
  }))

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboards')}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <LayoutGrid className="w-6 h-6 text-indigo-500" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {dashboard?.name ?? 'Dashboard'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Drag to reorder · Resize from corner</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => duplicateDashboardMut.mutate()}
            disabled={duplicateDashboardMut.isPending || !dashboard}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            <Copy className="w-4 h-4" />
            Duplicate
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add widget
          </button>
        </div>
      </div>

      {dashboard && (
        <FilterBar dashboard={dashboard} dashboardId={dashboardId!} />
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-72 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && widgets.length === 0 && (
        <div className="text-center py-20">
          <LayoutGrid className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-gray-500 dark:text-gray-400 font-medium mb-2">No widgets yet</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
            Add your first widget to visualise your spending
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
          >
            Add widget
          </button>
        </div>
      )}

      {!isLoading && widgets.length > 0 && (
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: rglLayout, md: rglLayout, sm: rglLayout, xs: rglLayout, xxs: rglLayout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 12, sm: 8, xs: 4, xxs: 2 }}
          rowHeight={70}
          margin={[12, 12]}
          containerPadding={[0, 0]}
          isDraggable={true}
          isResizable={true}
          draggableHandle=".widget-drag-handle"
          onLayoutChange={onLayoutChange}
        >
          {widgets.map(w => (
            <div key={w.id}>
              <WidgetCard
                widget={w}
                dashboard={dashboard}
                onEdit={() => setEditing(w)}
                onDelete={() => setDeletingId(w.id)}
                onDuplicate={() => duplicateWidgetMut.mutate(w.id)}
              />
            </div>
          ))}
        </ResponsiveGridLayout>
      )}

      {showForm && (
        <WidgetForm
          dashboardId={dashboardId!}
          onSave={req => createMut.mutate(req)}
          onClose={() => setShowForm(false)}
        />
      )}

      {editing && (
        <WidgetForm
          dashboardId={dashboardId!}
          existing={editing}
          onSave={req => updateMut.mutate({ id: editing.id, req })}
          onClose={() => setEditing(null)}
        />
      )}

      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Delete widget?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              This widget will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate(deletingId)}
                disabled={deleteMut.isPending}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
