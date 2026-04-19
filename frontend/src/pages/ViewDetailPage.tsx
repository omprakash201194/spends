import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, List, LayoutGrid, BarChart2, Loader2, X } from 'lucide-react'
import { clsx } from 'clsx'
import {
  getView, getViewTransactions, getViewSummary,
  removeTransactionFromView,
  type ViewResponse, type ViewTransactionItem, type ViewSummary,
  type CategoryBudgetItem,
} from '../api/views'
import { getBankAccounts } from '../api/bankAccounts'
import type { BankAccount } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L'
  if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'K'
  return '₹' + n.toLocaleString('en-IN')
}

function fmtFull(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const parts = s.split('T')[0].split('-')
  if (parts.length !== 3) return s
  const [y, m, d] = parts
  return `${d}/${m}/${y}`
}

// ── List tab ──────────────────────────────────────────────────────────────────

function ListTab({ viewId }: { viewId: string }) {
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<string | undefined>(undefined)

  const { data: accounts } = useQuery<BankAccount[]>({
    queryKey: ['bank-accounts'],
    queryFn: getBankAccounts,
    staleTime: 5 * 60 * 1000,
  })

  const { data, isPending } = useQuery({
    queryKey: ['view-transactions', viewId, page, accountId],
    queryFn: () => getViewTransactions(viewId, page, 25, accountId),
  })

  const removeMut = useMutation({
    onMutate: (txId: string) => setRemovingId(txId),
    mutationFn: (txId: string) => removeTransactionFromView(viewId, txId),
    onSettled: () => setRemovingId(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['view-transactions', viewId] }),
  })

  if (isPending) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>

  return (
    <div>
      {accounts && accounts.length > 1 && (
        <div className="mb-3 flex items-center gap-2">
          <select
            value={accountId ?? ''}
            onChange={e => { setAccountId(e.target.value || undefined); setPage(0) }}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All accounts</option>
            {accounts.map((a: BankAccount) => (
              <option key={a.id} value={a.id}>
                {a.bankName}{a.accountNumberMasked ? ` · ${a.accountNumberMasked}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      {(!data || data.content.length === 0) ? (
        <p className="text-center text-gray-400 dark:text-gray-500 py-12">No transactions in this view.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs text-gray-500 dark:text-gray-400 font-medium">
                  <th className="pb-2 pr-4 pl-1">Date</th>
                  <th className="pb-2 pr-4">Merchant</th>
                  <th className="pb-2 pr-4">Category</th>
                  <th className="pb-2 pr-4">Member</th>
                  <th className="pb-2 pr-4 text-right">Amount</th>
                  <th className="pb-2 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.content.map((tx: ViewTransactionItem) => (
                  <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="py-2 pr-4 pl-1 text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(tx.valueDate)}</td>
                    <td className="py-2 pr-4 max-w-[180px]">
                      <p className="truncate font-medium text-gray-800 dark:text-gray-100">{tx.merchantName ?? '—'}</p>
                      <p className="truncate text-xs text-gray-400 dark:text-gray-500">{tx.rawRemarks}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{tx.bankName}</p>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-1.5">
                        {tx.categoryColor && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tx.categoryColor }} />}
                        <span className="text-gray-600 dark:text-gray-300">{tx.categoryName ?? '—'}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">{tx.memberName}</td>
                    <td className="py-2 pr-4 text-right font-mono">
                      {tx.withdrawalAmount > 0
                        ? <span className="text-red-600">{fmtFull(tx.withdrawalAmount)}</span>
                        : <span className="text-green-600">{fmtFull(tx.depositAmount)}</span>}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => removeMut.mutate(tx.id)}
                        disabled={removingId === tx.id}
                        className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 rounded"
                        aria-label={`Remove ${tx.merchantName ?? tx.rawRemarks} from view`}
                        title="Remove from view"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-500 dark:text-gray-400">
              <span>{data.totalElements} transactions</span>
              <div className="flex gap-2">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700">
                  Prev
                </button>
                <span className="px-3 py-1.5">{page + 1} / {data.totalPages}</span>
                <button disabled={page >= data.totalPages - 1} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700">
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Board tab ─────────────────────────────────────────────────────────────────

function BoardTab({ viewId }: { viewId: string }) {
  const { data, isPending } = useQuery({
    queryKey: ['view-board', viewId],
    queryFn: () => getViewTransactions(viewId, 0, 500),
  })

  if (isPending) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
  if (!data || data.content.length === 0) return <p className="text-center text-gray-400 dark:text-gray-500 py-12">No transactions in this view.</p>

  // Group by category
  const groups = data.content.reduce<Record<string, ViewTransactionItem[]>>((acc, tx) => {
    const key = tx.categoryName ?? 'Uncategorised'
    if (!acc[key]) acc[key] = []
    acc[key].push(tx)
    return acc
  }, {})

  return (
    <div className="overflow-x-auto">
      {data.totalElements > data.content.length && (
        <p className="text-xs text-amber-600 mb-3">
          Showing first {data.content.length} of {data.totalElements} transactions.
        </p>
      )}
      <div className="flex gap-4 pb-4" style={{ minWidth: `${Object.keys(groups).length * 220}px` }}>
        {Object.entries(groups).map(([cat, txs]) => {
          const total = txs.reduce((s, tx) => s + tx.withdrawalAmount, 0)
          const color = txs[0]?.categoryColor
          return (
            <div key={cat} className="w-52 flex-shrink-0">
              <div className="flex items-center gap-1.5 mb-2">
                {color && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />}
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide truncate">{cat}</span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{fmt(total)}</p>
              <div className="space-y-2">
                {txs.map(tx => (
                  <div key={tx.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 shadow-sm">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{tx.merchantName ?? tx.rawRemarks.slice(0, 30)}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-400 dark:text-gray-500">{fmtDate(tx.valueDate)}</span>
                      <span className="text-xs font-mono font-semibold text-red-600">{fmt(tx.withdrawalAmount)}</span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{tx.memberName}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Summary tab ───────────────────────────────────────────────────────────────

function SummaryTab({ viewId }: { viewId: string }) {
  const { data: summary, isPending } = useQuery<ViewSummary>({
    queryKey: ['view-summary', viewId],
    queryFn: () => getViewSummary(viewId),
  })

  if (isPending) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
  if (!summary) return null

  const budgetPct = summary.totalBudget != null && summary.totalBudget > 0
    ? Math.min(100, Math.round((summary.totalSpent / summary.totalBudget) * 100))
    : null

  return (
    <div className="space-y-6">
      {/* Total gauge */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Spent</p>
        <p className="text-3xl font-bold text-gray-900 dark:text-white mb-3">{fmtFull(summary.totalSpent)}</p>
        {budgetPct !== null && summary.totalBudget != null && (
          <>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Budget: {fmtFull(summary.totalBudget)}</span>
              <span>{budgetPct}%</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full', budgetPct >= 100 ? 'bg-red-500' : budgetPct >= 80 ? 'bg-amber-400' : 'bg-blue-500')}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Category breakdown */}
      {summary.categories.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">By Category</h3>
          <div className="space-y-3">
            {summary.categories.map((cat: CategoryBudgetItem) => {
              const pct = summary.totalSpent > 0 ? Math.round((cat.actualAmount / summary.totalSpent) * 100) : 0
              const budgetOver = cat.expectedAmount != null && cat.actualAmount > cat.expectedAmount
              return (
                <div key={cat.categoryId}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-1.5">
                      {cat.categoryColor && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.categoryColor }} />}
                      <span className="text-gray-700 dark:text-gray-200">{cat.categoryName}</span>
                      {budgetOver && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Over</span>}
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-medium dark:text-gray-100">{fmt(cat.actualAmount)}</span>
                      {cat.expectedAmount != null && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">/ {fmt(cat.expectedAmount)}</span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={clsx('h-full rounded-full', budgetOver ? 'bg-red-400' : 'bg-blue-500')}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: budgetOver ? undefined : (cat.categoryColor ?? undefined),
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Member breakdown */}
      {summary.members.length > 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">By Member</h3>
          <div className="space-y-3">
            {summary.members.map(m => {
              const pct = summary.totalSpent > 0 ? Math.round((m.amount / summary.totalSpent) * 100) : 0
              return (
                <div key={m.userId}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white">
                        {(m.displayName[0] ?? '?').toUpperCase()}
                      </div>
                      <span className="text-gray-700 dark:text-gray-200">{m.displayName}</span>
                      <span className="text-gray-400 dark:text-gray-500 text-xs">({m.count} txns)</span>
                    </div>
                    <span className="font-mono font-medium dark:text-gray-100">{fmt(m.amount)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main detail page ──────────────────────────────────────────────────────────

type TabId = 'list' | 'board' | 'summary'

const TABS: { id: TabId; label: string; Icon: typeof List }[] = [
  { id: 'list',    label: 'List',    Icon: List },
  { id: 'board',   label: 'Board',   Icon: LayoutGrid },
  { id: 'summary', label: 'Summary', Icon: BarChart2 },
]

export default function ViewDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabId>('list')

  const { data: view, isPending } = useQuery<ViewResponse>({
    queryKey: ['view', id],
    queryFn: () => getView(id!),
    enabled: !!id,
  })

  if (isPending) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  if (!view) return null

  const pct = view.totalBudget != null && view.totalBudget > 0
    ? Math.min(100, Math.round((view.totalSpent / view.totalBudget) * 100))
    : null

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Back + header */}
      <button onClick={() => navigate('/views')} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4">
        <ArrowLeft className="w-4 h-4" /> Views
      </button>

      <div className="flex items-start gap-3 mb-2">
        {view.color && <span className="w-4 h-4 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: view.color }} />}
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{view.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{fmtDate(view.startDate)} — {fmtDate(view.endDate)}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-sm mb-5">
        <span className="font-semibold text-gray-900 dark:text-white">{fmt(view.totalSpent)} spent</span>
        {pct !== null && view.totalBudget != null && (
          <span className="text-gray-400 dark:text-gray-500">of {fmt(view.totalBudget)} budget ({pct}%)</span>
        )}
        <span className="text-gray-400 dark:text-gray-500">{view.transactionCount} transactions</span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-5">
        {TABS.map(({ id: tid, label, Icon }) => (
          <button
            key={tid}
            onClick={() => setTab(tid)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === tid
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'list'    && <ListTab    viewId={id!} />}
      {tab === 'board'   && <BoardTab   viewId={id!} />}
      {tab === 'summary' && <SummaryTab viewId={id!} />}
    </div>
  )
}
