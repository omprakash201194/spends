import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Target, Plus, Trash2, CheckCircle2, Clock, X } from 'lucide-react'
import {
  getGoals, createGoal, deleteGoal,
  type GoalResponse, type CreateGoalRequest,
} from '../api/savingsGoals'

// ── Helpers ───────────────────────────────────────────────────────────────────

function inrFull(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function daysRemaining(targetDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(targetDate)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const [showForm, setShowForm] = useState(false)

  const { data: goals = [], isLoading, isError } = useQuery({
    queryKey: ['goals'],
    queryFn: getGoals,
    staleTime: 60_000,
  })

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Savings Goals
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track progress toward financial targets using your net savings
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Goal
        </button>
      </div>

      {showForm && <CreateGoalForm onDone={() => setShowForm(false)} />}

      {isLoading && <LoadingSkeleton />}

      {isError && (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          Failed to load goals. Please refresh.
        </div>
      )}

      {!isLoading && !isError && goals.length === 0 && !showForm && (
        <EmptyState onAdd={() => setShowForm(true)} />
      )}

      {goals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {goals.map(goal => <GoalCard key={goal.id} goal={goal} />)}
        </div>
      )}
    </div>
  )
}

// ── Create form ────────────────────────────────────────────────────────────────

function CreateGoalForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState<CreateGoalRequest>({
    name: '',
    target: 0,
    startDate: today,
    targetDate: null,
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: createGoal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      onDone()
    },
    onError: () => setError('Failed to create goal. Please try again.'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Goal name is required'); return }
    if (form.target <= 0)  { setError('Target amount must be greater than 0'); return }
    setError('')
    mutation.mutate(form)
  }

  const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 mb-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">New savings goal</h2>
        <button
          type="button"
          onClick={onDone}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelCls}>Goal name</label>
          <input
            type="text"
            placeholder="e.g. Emergency Fund, Vacation, New Laptop"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            maxLength={100}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Target amount (&#8377;)</label>
          <input
            type="number"
            min="1"
            placeholder="50000"
            value={form.target || ''}
            onChange={e => setForm(f => ({ ...f, target: Number(e.target.value) }))}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Start tracking from</label>
          <input
            type="date"
            value={form.startDate}
            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>
            Target date <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            type="date"
            value={form.targetDate ?? ''}
            onChange={e => setForm(f => ({ ...f, targetDate: e.target.value || null }))}
            className={inputCls}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{error}</p>}

      <div className="flex gap-3 mt-4">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {mutation.isPending ? 'Creating\u2026' : 'Create Goal'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Goal card ─────────────────────────────────────────────────────────────────

function GoalCard({ goal }: { goal: GoalResponse }) {
  const qc = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => deleteGoal(goal.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
    onError: () => setConfirmDelete(false),
  })

  const days = goal.targetDate ? daysRemaining(goal.targetDate) : null

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      {/* Header row */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {goal.achieved
            ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            : <Target className="w-5 h-5 text-blue-500 flex-shrink-0" />
          }
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight truncate">
            {goal.name}
          </h3>
        </div>

        {confirmDelete ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>{inrFull(goal.saved)} saved</span>
          <span>{goal.percentage}%</span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              goal.achieved ? 'bg-emerald-500' : 'bg-blue-500'
            }`}
            style={{ width: `${goal.percentage}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Target: {inrFull(goal.target)}
        </p>
      </div>

      {/* Status badge */}
      {goal.achieved ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
          <CheckCircle2 className="w-3 h-3" /> Achieved!
        </span>
      ) : days !== null ? (
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
          days < 0
            ? 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950'
            : days <= 30
              ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950'
              : 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700'
        }`}>
          <Clock className="w-3 h-3" />
          {days < 0 ? `${Math.abs(days)} days overdue` : `${days} days left`}
        </span>
      ) : (
        <span className="text-xs text-gray-400 dark:text-gray-500">No deadline set</span>
      )}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-16">
      <Target className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
      <p className="text-gray-500 dark:text-gray-400 mb-4">No savings goals yet</p>
      <button
        onClick={onAdd}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Create your first goal
      </button>
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 animate-pulse"
        >
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4" />
          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full mb-2" />
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/2" />
        </div>
      ))}
    </div>
  )
}
