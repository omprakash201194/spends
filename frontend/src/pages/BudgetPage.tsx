import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PiggyBank, Pencil, Trash2, Check, X } from 'lucide-react'
import { getBudgets, setBudget, deleteBudget, type CategoryBudget, type MonthSummary } from '../api/budget'
import InsightCard from '../components/InsightCard'

// ── Helpers ───────────────────────────────────────────────────────────────────

function inrFull(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function progressColor(pct: number, hasLimit: boolean) {
  if (!hasLimit) return 'bg-gray-300'
  if (pct >= 100) return 'bg-red-500'
  if (pct >= 80)  return 'bg-amber-400'
  return 'bg-emerald-500'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['budgets'],
    queryFn: getBudgets,
    staleTime: 30_000,
  })

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Budgets</h1>
        {data && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{data.month}</p>
        )}
      </div>

      {isLoading && <LoadingSkeleton />}
      {isError   && <ErrorState />}
      {data      && (
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 lg:items-start">
          <BudgetGrid summary={data} />
          <div className="mt-6 lg:mt-0 lg:sticky lg:top-6">
            <InsightCard type="BUDGET" label="Get Budget Advice" />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Grid ──────────────────────────────────────────────────────────────────────

function BudgetGrid({ summary }: { summary: MonthSummary }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {summary.categories.map(cat => (
        <BudgetCard
          key={cat.categoryId}
          cat={cat}
          year={summary.year}
          monthNumber={summary.monthNumber}
        />
      ))}
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

function BudgetCard({
  cat,
  year,
  monthNumber,
}: {
  cat: CategoryBudget
  year: number
  monthNumber: number
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [rollover, setRollover] = useState(false)

  const saveMutation = useMutation({
    mutationFn: (limit: number) => setBudget(cat.categoryId, year, monthNumber, limit, rollover),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      setEditing(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteBudget(cat.budgetId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })

  const startEdit = () => {
    setInput(cat.limit != null ? String(Math.round(cat.limit)) : '')
    setRollover(cat.rollover)
    setEditing(true)
  }

  const confirmEdit = () => {
    const val = parseFloat(input)
    if (!isNaN(val) && val > 0) saveMutation.mutate(val)
  }

  const hasLimit      = cat.limit != null
  const displayLimit  = cat.effectiveLimit ?? cat.limit   // show effective limit when rollover active
  const pct           = cat.percentage
  const barColor      = progressColor(pct, hasLimit)
  const barWidth      = hasLimit ? `${Math.min(pct, 100)}%` : '0%'
  const overBudget    = hasLimit && pct >= 100
  const hasCarryOver  = cat.rollover && cat.effectiveLimit != null && cat.limit != null
                        && cat.effectiveLimit > cat.limit

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border p-4 sm:p-5 ${overBudget ? 'border-red-300' : 'border-gray-200 dark:border-gray-700'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: cat.categoryColor ?? '#94a3b8' }}
          />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{cat.categoryName}</span>
        </div>

        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {hasLimit && !editing && (
            <>
              <button
                onClick={startEdit}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded"
                title="Edit limit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="p-1 text-gray-400 hover:text-red-500 rounded disabled:opacity-50"
                title="Remove limit"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {editing && (
            <>
              <button
                onClick={confirmEdit}
                disabled={saveMutation.isPending}
                className="p-1 text-emerald-600 hover:text-emerald-700 rounded disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setEditing(false)}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Spent + limit */}
      <div className="flex items-baseline justify-between mb-2 gap-2">
        <span className="text-lg font-bold text-gray-900 dark:text-white">{inrFull(cat.spent)}</span>
        {hasLimit && !editing ? (
          <span className="text-sm text-gray-400 dark:text-gray-500 flex-shrink-0">of {inrFull(displayLimit!)}</span>
        ) : editing ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-sm text-gray-400 dark:text-gray-500">₹</span>
            <input
              autoFocus
              type="number"
              min="1"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmEdit()
                if (e.key === 'Escape') setEditing(false)
              }}
              className="w-24 text-sm border border-gray-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
              placeholder="limit"
            />
          </div>
        ) : (
          <button
            onClick={startEdit}
            className="text-xs text-blue-600 hover:underline flex-shrink-0"
          >
            Set limit
          </button>
        )}
      </div>

      {/* Rollover toggle (visible while editing) */}
      {editing && (
        <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rollover}
            onChange={e => setRollover(e.target.checked)}
            className="rounded accent-blue-600"
          />
          Carry forward unspent budget to next month
        </label>
      )}

      {/* Carry-over badge (visible when rollover is active and there is a bonus) */}
      {hasCarryOver && !editing && (
        <p className="text-xs text-blue-500 dark:text-blue-400 mb-1">
          +{inrFull(cat.effectiveLimit! - cat.limit!)} carried over from last month
        </p>
      )}

      {/* Progress bar */}
      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: barWidth }}
        />
      </div>

      {/* Percentage label */}
      {hasLimit && (
        <p className={`text-xs mt-1.5 ${overBudget ? 'text-red-500 font-semibold' : 'text-gray-400 dark:text-gray-500'}`}>
          {pct}% used{overBudget && ' — over budget'}
        </p>
      )}
    </div>
  )
}

// ── Skeletons / states ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">
      {[...Array(9)].map((_, i) => (
        <div key={i} className="bg-gray-100 dark:bg-gray-700 rounded-xl h-32" />
      ))}
    </div>
  )
}

function ErrorState() {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
      <PiggyBank className="mx-auto w-8 h-8 text-red-300 mb-2" />
      <p className="text-red-600 font-medium">Failed to load budgets</p>
      <p className="text-sm text-red-400 mt-1">Check backend logs for details</p>
    </div>
  )
}
