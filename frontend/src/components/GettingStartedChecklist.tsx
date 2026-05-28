import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X, Sparkles } from 'lucide-react'
import { clsx } from 'clsx'
import { getBankAccounts } from '../api/bankAccounts'
import { getBudgets } from '../api/budget'
import { getGoals } from '../api/savingsGoals'

const DISMISS_KEY = 'spends-checklist-dismissed'

interface Step {
  id: string
  label: string
  detail: string
  to: string
  done: boolean
}

interface Props {
  totalTransactions: number
}

export default function GettingStartedChecklist({ totalTransactions }: Props) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === 'true'
  )
  const [open, setOpen] = useState(true)

  const { data: accounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: getBankAccounts,
    staleTime: 60_000,
  })

  const { data: budgetData } = useQuery({
    queryKey: ['budgets'],
    queryFn: getBudgets,
    staleTime: 60_000,
  })

  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: getGoals,
    staleTime: 60_000,
  })

  const hasAccounts     = accounts.length > 0
  const hasTransactions = totalTransactions > 0
  const hasBudgets      = (budgetData?.categories ?? []).some(c => c.limit != null && c.limit > 0)
  const hasGoals        = goals.length > 0

  const steps: Step[] = [
    {
      id: 'account',
      label: 'Add a bank account',
      detail: 'Tell SpendStack which bank you import from.',
      to: '/accounts',
      done: hasAccounts,
    },
    {
      id: 'import',
      label: 'Import your first statement',
      detail: 'Upload an XLS or CSV export from your bank.',
      to: '/import',
      done: hasTransactions,
    },
    {
      id: 'budget',
      label: 'Set a budget for one category',
      detail: 'Cap your monthly spend on Food, Transport, or anything else.',
      to: '/budgets',
      done: hasBudgets,
    },
    {
      id: 'goal',
      label: 'Create a savings goal',
      detail: 'Track progress toward an emergency fund, vacation, or any target.',
      to: '/goals',
      done: hasGoals,
    },
  ]

  const doneCount = steps.filter(s => s.done).length
  const allDone   = doneCount === steps.length

  if (dismissed) return null

  // Once all steps are done offer to dismiss permanently — show a compact congrats banner
  if (allDone) {
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-emerald-500 flex-shrink-0" aria-hidden="true" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            You're all set! SpendStack is fully configured.
          </p>
        </div>
        <button
          onClick={() => { localStorage.setItem(DISMISS_KEY, 'true'); setDismissed(true) }}
          className="text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-200 transition-colors flex-shrink-0"
          aria-label="Dismiss checklist"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-xl border border-blue-100 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-blue-100/60 dark:hover:bg-blue-900/30 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            Get started — {doneCount}/{steps.length} done
          </span>
          {/* Mini progress bar */}
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-24 h-1.5 rounded-full bg-blue-200 dark:bg-blue-900 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 dark:bg-blue-400 transition-all duration-500"
                style={{ width: `${(doneCount / steps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); localStorage.setItem(DISMISS_KEY, 'true'); setDismissed(true) }}
            className="text-blue-300 hover:text-blue-500 dark:hover:text-blue-200 transition-colors p-0.5"
            aria-label="Dismiss checklist"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          {open
            ? <ChevronUp className="w-4 h-4 text-blue-400 flex-shrink-0" aria-hidden="true" />
            : <ChevronDown className="w-4 h-4 text-blue-400 flex-shrink-0" aria-hidden="true" />
          }
        </div>
      </button>

      {/* Steps */}
      {open && (
        <div className="px-4 pb-4 border-t border-blue-100 dark:border-blue-900/60">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            {steps.map((step, i) => (
              <Link
                key={step.id}
                to={step.done ? '#' : step.to}
                onClick={e => step.done && e.preventDefault()}
                className={clsx(
                  'flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-all',
                  step.done
                    ? 'border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/30 cursor-default'
                    : 'border-blue-100 dark:border-blue-900/50 bg-white dark:bg-gray-900/60 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm'
                )}
              >
                {/* Step number / check */}
                <div className="flex-shrink-0 mt-0.5">
                  {step.done
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-500" aria-hidden="true" />
                    : <Circle className="w-5 h-5 text-blue-300 dark:text-blue-700" aria-hidden="true" />
                  }
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className={clsx(
                    'text-xs font-semibold leading-snug',
                    step.done
                      ? 'text-emerald-700 dark:text-emerald-400 line-through decoration-emerald-300'
                      : 'text-gray-800 dark:text-gray-200'
                  )}>
                    <span className="text-blue-400 dark:text-blue-600 mr-1 not-italic font-normal no-underline" style={{ textDecoration: 'none' }}>
                      {i + 1}.
                    </span>
                    {step.label}
                  </p>
                  {!step.done && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 leading-snug mt-0.5">{step.detail}</p>
                  )}
                </div>

                {/* Arrow for pending steps */}
                {!step.done && (
                  <span className="text-blue-400 dark:text-blue-600 text-xs flex-shrink-0 mt-0.5">→</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
