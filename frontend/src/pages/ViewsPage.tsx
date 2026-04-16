import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Calendar, Trash2, Loader2, LayoutGrid,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  listViews, createView, deleteView,
  type ViewResponse, type ViewType, type CreateViewRequest,
  TRIP_TEMPLATE, EVENT_TEMPLATE,
} from '../api/views'
import { getCategories, type Category } from '../api/categories'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L'
  if (n >= 1000)   return '₹' + (n / 1000).toFixed(1) + 'K'
  return '₹' + n.toLocaleString('en-IN')
}

function fmtDate(s: string) {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

const TYPE_LABEL: Record<ViewType, string>  = { TRIP: 'Trip', EVENT: 'Event', CUSTOM: 'Custom' }
const TYPE_COLOR: Record<ViewType, string>  = {
  TRIP:   'bg-blue-100 text-blue-700',
  EVENT:  'bg-purple-100 text-purple-700',
  CUSTOM: 'bg-gray-100 text-gray-600',
}

// ── View card ─────────────────────────────────────────────────────────────────

function ViewCard({ view, onDelete }: { view: ViewResponse; onDelete: () => void }) {
  const navigate = useNavigate()
  const pct = view.totalBudget && view.totalBudget > 0
    ? Math.min(100, Math.round((view.totalSpent / view.totalBudget) * 100))
    : null

  return (
    <div
      onClick={() => navigate(`/views/${view.id}`)}
      className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {view.color && (
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: view.color }}
            />
          )}
          <h3 className="font-semibold text-gray-900 truncate">{view.name}</h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', TYPE_COLOR[view.type])}>
            {TYPE_LABEL[view.type]}
          </span>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="p-1 text-gray-400 hover:text-red-500 rounded"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Date range */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
        <Calendar className="w-3.5 h-3.5" />
        {fmtDate(view.startDate)} — {fmtDate(view.endDate)}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm mb-3">
        <span className="text-gray-500">{view.transactionCount} transactions</span>
        <span className="font-semibold text-gray-900">{fmt(view.totalSpent)}</span>
      </div>

      {/* Budget progress */}
      {view.totalBudget && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Budget</span>
            <span>{pct}% of {fmt(view.totalBudget)}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={clsx('h-full rounded-full', pct! >= 100 ? 'bg-red-500' : pct! >= 80 ? 'bg-amber-400' : 'bg-blue-500')}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Create modal ──────────────────────────────────────────────────────────────

const STEPS = ['Details', 'Type', 'Budget'] as const
type Step = typeof STEPS[number]

function CreateViewModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [step, setStep]           = useState<Step>('Details')
  const [name, setName]           = useState('')
  const [type, setType]           = useState<ViewType>('TRIP')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [description, setDesc]    = useState('')
  const [color, setColor]         = useState('#3B82F6')
  const [totalBudget, setBudget]  = useState('')
  const [catBudgets, setCatBudgets] = useState<{ categoryId: string; expectedAmount: number }[]>([])

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: getCategories,
  })

  const createMut = useMutation({
    mutationFn: createView,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['views'] })
      onClose()
    },
  })

  function applyTemplate(t: ViewType) {
    setType(t)
    const template = t === 'TRIP' ? TRIP_TEMPLATE : t === 'EVENT' ? EVENT_TEMPLATE : []
    const lines = template
      .map(line => {
        const cat = categories.find(c => c.name === line.categoryName)
        return cat ? { categoryId: cat.id, expectedAmount: line.suggested } : null
      })
      .filter((x): x is { categoryId: string; expectedAmount: number } => x !== null)
    setCatBudgets(lines)
  }

  function handleSubmit() {
    const req: CreateViewRequest = {
      name,
      type,
      startDate,
      endDate,
      description: description || undefined,
      color,
      totalBudget: totalBudget ? Number(totalBudget) : undefined,
      categoryBudgets: catBudgets,
    }
    createMut.mutate(req)
  }

  const canNext =
    step === 'Details' ? name.trim().length > 0 && startDate.length > 0 && endDate.length > 0 && endDate >= startDate :
    step === 'Type'    ? true : false

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Create View</h2>
          <div className="flex gap-1">
            {STEPS.map((s, i) => (
              <div key={s} className={clsx('w-2 h-2 rounded-full', s === step ? 'bg-blue-600' : i < STEPS.indexOf(step) ? 'bg-blue-200' : 'bg-gray-200')} />
            ))}
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Step 1: Details */}
          {step === 'Details' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Goa Trip, Shaadi 2025"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                  <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
                  <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Short note"
                  value={description}
                  onChange={e => setDesc(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Color</label>
                <input type="color" className="w-8 h-8 rounded cursor-pointer border-0" value={color} onChange={e => setColor(e.target.value)} />
                <span className="text-xs text-gray-400 font-mono">{color}</span>
              </div>
            </>
          )}

          {/* Step 2: Type + template */}
          {step === 'Type' && (
            <>
              <p className="text-sm text-gray-500">Pick a type. Trip and Event pre-fill suggested category budgets.</p>
              <div className="space-y-2">
                {(['TRIP', 'EVENT', 'CUSTOM'] as ViewType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => applyTemplate(t)}
                    className={clsx(
                      'w-full text-left px-4 py-3 rounded-xl border-2 transition-colors',
                      type === t ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <p className="font-medium text-sm">{TYPE_LABEL[t]}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t === 'TRIP' ? 'Transport, Food, Entertainment, Shopping' :
                       t === 'EVENT' ? 'Shopping, Food, Entertainment, Miscellaneous' :
                       'No preset — set budgets manually'}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 3: Budget */}
          {step === 'Budget' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total budget (optional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400 text-sm">₹</span>
                  <input
                    type="number" min="0"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 50000"
                    value={totalBudget}
                    onChange={e => setBudget(e.target.value)}
                  />
                </div>
              </div>
              {catBudgets.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Category budgets (from template)</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {catBudgets.map((cb, i) => {
                      const cat = categories.find(c => c.id === cb.categoryId)
                      return (
                        <div key={cb.categoryId} className="flex items-center gap-2">
                          {cat?.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color ?? undefined }} />}
                          <span className="text-sm text-gray-600 flex-1">{cat?.name}</span>
                          <div className="relative w-28">
                            <span className="absolute left-2 top-1.5 text-gray-400 text-xs">₹</span>
                            <input
                              type="number" min="0"
                              className="w-full pl-5 pr-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                              value={cb.expectedAmount}
                              onChange={e => {
                                const updated = [...catBudgets]
                                updated[i] = { ...cb, expectedAmount: Number(e.target.value) }
                                setCatBudgets(updated)
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between px-6 py-4 border-t border-gray-100">
          <button
            onClick={step === 'Details' ? onClose : () => setStep(STEPS[STEPS.indexOf(step) - 1])}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            {step === 'Details' ? 'Cancel' : 'Back'}
          </button>
          {step !== 'Budget' ? (
            <button
              disabled={!canNext}
              onClick={() => setStep(STEPS[STEPS.indexOf(step) + 1])}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={createMut.isPending}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center gap-2"
            >
              {createMut.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create View
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ViewsPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const { data: views = [], isLoading } = useQuery<ViewResponse[]>({
    queryKey: ['views'],
    queryFn: listViews,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteView(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['views'] }),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Views</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track spend for trips and events</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New View
        </button>
      </div>

      {/* Card grid */}
      {views.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <LayoutGrid className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No views yet</p>
          <p className="text-sm mt-1">Create a view to track spending for a trip or event</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {views.map(v => (
            <ViewCard
              key={v.id}
              view={v}
              onDelete={() => {
                if (confirm(`Delete "${v.name}"? This cannot be undone.`)) {
                  deleteMut.mutate(v.id)
                }
              }}
            />
          ))}
        </div>
      )}

      {showCreate && <CreateViewModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
