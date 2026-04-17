import { useState, useCallback } from 'react'
import { Download, MessageSquare } from 'lucide-react'
import { downloadTransactionsCsv } from '../api/export'
import InsightCard from '../components/InsightCard'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, Check, X, CircleDot,
  Bookmark,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  getTransactions, updateCategory, toggleReviewed, updateNote,
  type Transaction, type TransactionFilters,
} from '../api/transactions'
import { getCategories, type Category } from '../api/categories'
import { getBankAccounts } from '../api/bankAccounts'
import { listViews, addTransactionsToView, type ViewResponse } from '../api/views'
import { useDebounce } from '../hooks/useDebounce'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(n: number) {
  return n === 0 ? '—' : '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(s: string) {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TransactionPage() {
  const qc = useQueryClient()

  // filters
  const [search, setSearch]         = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId]   = useState('')
  const [type, setType]             = useState<'ALL' | 'DEBIT' | 'CREDIT'>('ALL')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')

  // sort
  const [sortBy, setSortBy]   = useState('valueDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // pagination
  const [page, setPage] = useState(0)

  const debouncedSearch = useDebounce(search, 300)

  const filters: TransactionFilters = {
    search: debouncedSearch || undefined,
    categoryId: categoryId || undefined,
    accountId: accountId || undefined,
    type,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    size: 25,
    sortBy,
    sortDir,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => getTransactions(filters),
    placeholderData: (prev) => prev,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    staleTime: Infinity,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: getBankAccounts,
    staleTime: Infinity,
  })

  const toggleReviewedMut = useMutation({
    mutationFn: toggleReviewed,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })

  const handleSort = useCallback((col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortBy(col)
      setSortDir('desc')
    }
    setPage(0)
  }, [sortBy])

  const resetFilters = () => {
    setSearch(''); setCategoryId(''); setAccountId('')
    setType('ALL'); setDateFrom(''); setDateTo(''); setPage(0)
  }

  const hasFilters = search || categoryId || accountId || type !== 'ALL' || dateFrom || dateTo

  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      await downloadTransactionsCsv({
        search: debouncedSearch || undefined,
        categoryId: categoryId || undefined,
        accountId: accountId || undefined,
        type,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
    } catch {
      window.alert('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
          {data && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {data.totalElements.toLocaleString()} transactions
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button onClick={resetFilters} className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Clear filters
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search remarks or merchant…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
          />
        </div>

        {/* Type */}
        <select
          value={type}
          onChange={(e) => { setType(e.target.value as typeof type); setPage(0) }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
        >
          <option value="ALL">All types</option>
          <option value="DEBIT">Debit only</option>
          <option value="CREDIT">Credit only</option>
        </select>

        {/* Category */}
        <select
          value={categoryId}
          onChange={(e) => { setCategoryId(e.target.value); setPage(0) }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Account */}
        {accounts.length > 1 && (
          <select
            value={accountId}
            onChange={(e) => { setAccountId(e.target.value); setPage(0) }}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.bankName} {a.accountNumberMasked ?? ''}</option>
            ))}
          </select>
        )}

        {/* Date range */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(0) }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
          title="From date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(0) }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
          title="To date"
        />
      </div>

      {/* Table + InsightCard sidebar */}
      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-4 lg:items-start">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
              <tr>
                <Th col="valueDate"   label="Date"       current={sortBy} dir={sortDir} onSort={handleSort} />
                <Th col="merchant"    label="Merchant"   current={sortBy} dir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Category
                </th>
                <Th col="withdrawal"  label="Debit"      current={sortBy} dir={sortDir} onSort={handleSort} className="text-right" />
                <Th col="deposit"     label="Credit"     current={sortBy} dir={sortDir} onSort={handleSort} className="text-right" />
                <Th col="balance"     label="Balance"    current={sortBy} dir={sortDir} onSort={handleSort} className="text-right" />
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide w-16">
                  Done
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Note
                </th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-16 text-gray-400 dark:text-gray-500">Loading…</td></tr>
              ) : !data || data.content.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-16 text-gray-400 dark:text-gray-500">No transactions found</td></tr>
              ) : data.content.map((tx) => (
                <TxRow
                  key={tx.id}
                  tx={tx}
                  categories={categories}
                  onToggleReviewed={() => toggleReviewedMut.mutate(tx.id)}
                  onCategoryUpdated={() => qc.invalidateQueries({ queryKey: ['transactions'] })}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between bg-white dark:bg-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Page {data.page + 1} of {data.totalPages} · {data.totalElements.toLocaleString()} total
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={data.page === 0}
                className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages - 1, p + 1))}
                disabled={data.page >= data.totalPages - 1}
                className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>{/* end table card */}

      <div className="mt-4 lg:mt-0 lg:sticky lg:top-6">
        <InsightCard type="TRANSACTIONS" label="Analyse My Spending" />
      </div>
      </div>{/* end sidebar grid */}
    </div>
  )
}

// ── Sortable column header ────────────────────────────────────────────────────

function Th({ col, label, current, dir, onSort, className }: {
  col: string; label: string; current: string; dir: string
  onSort: (c: string) => void; className?: string
}) {
  const active = current === col
  return (
    <th
      onClick={() => onSort(col)}
      className={clsx(
        'px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer select-none hover:text-gray-800 dark:hover:text-gray-200',
        className
      )}
    >
      <span className="flex items-center gap-1">
        {label}
        {active
          ? dir === 'desc'
            ? <ChevronDown className="w-3 h-3" />
            : <ChevronUp className="w-3 h-3" />
          : <ChevronsUpDown className="w-3 h-3 opacity-40" />}
      </span>
    </th>
  )
}

// ── Add to view picker ────────────────────────────────────────────────────────

function AddToViewPicker({
  txId,
  onClose,
}: {
  txId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: views = [] } = useQuery<ViewResponse[]>({
    queryKey: ['views'],
    queryFn: listViews,
  })

  const addMut = useMutation({
    mutationFn: (viewId: string) => addTransactionsToView(viewId, [txId]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['views'] })
      onClose()
    },
  })

  return (
    <div className="absolute z-40 right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1">
      <p className="px-3 py-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Add to view</p>
      {views.length === 0 && (
        <p className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">No views yet</p>
      )}
      {views.map(v => (
        <button
          key={v.id}
          onClick={() => addMut.mutate(v.id)}
          disabled={addMut.isPending}
          className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          {v.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: v.color }} />}
          <span className="truncate dark:text-gray-200">{v.name}</span>
        </button>
      ))}
    </div>
  )
}

// ── Transaction row ───────────────────────────────────────────────────────────

function TxRow({ tx, categories, onToggleReviewed, onCategoryUpdated }: {
  tx: Transaction
  categories: Category[]
  onToggleReviewed: () => void
  onCategoryUpdated: () => void
}) {
  const qc = useQueryClient()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [rulePrompt, setRulePrompt] = useState<{ categoryId: string; categoryName: string } | null>(null)
  const [viewPickerOpen, setViewPickerOpen] = useState(false)
  const [editingNote, setEditingNote] = useState(false)
  const [noteText, setNoteText] = useState('')

  const noteMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => updateNote(id, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })

  const updateCatMut = useMutation({
    mutationFn: ({ catId, createRule, pattern }: { catId: string; createRule: boolean; pattern?: string }) =>
      updateCategory(tx.id, catId, createRule, pattern),
    onSuccess: () => { onCategoryUpdated(); setPickerOpen(false); setRulePrompt(null) },
  })

  const handleSelectCategory = (cat: Category) => {
    if (cat.id === tx.category?.id) { setPickerOpen(false); return }
    setPickerOpen(false)
    setRulePrompt({ categoryId: cat.id, categoryName: cat.name })
  }

  const handleRuleDecision = (createRule: boolean) => {
    if (!rulePrompt) return
    updateCatMut.mutate({ catId: rulePrompt.categoryId, createRule })
  }

  const debit  = tx.withdrawalAmount > 0
  const credit = tx.depositAmount > 0

  return (
    <>
      <tr className={clsx('hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors', tx.reviewed && 'opacity-60')}>
        {/* Date */}
        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
          {formatDate(tx.valueDate)}
        </td>

        {/* Merchant + remarks */}
        <td className="px-4 py-3 max-w-xs">
          <p className="font-medium text-gray-900 dark:text-white truncate">
            {tx.merchantName ?? tx.rawRemarks?.substring(0, 40)}
          </p>
          {tx.merchantName && (
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{tx.rawRemarks?.substring(0, 60)}</p>
          )}
        </td>

        {/* Category picker */}
        <td className="px-4 py-3 relative">
          <button
            onClick={() => setPickerOpen((o) => !o)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border hover:shadow-sm transition-shadow"
            style={{
              backgroundColor: tx.category?.color ? tx.category.color + '20' : '#f3f4f6',
              borderColor: tx.category?.color ?? '#e5e7eb',
              color: tx.category?.color ?? '#6b7280',
            }}
          >
            <CircleDot className="w-3 h-3" />
            {tx.category?.name ?? 'Uncategorized'}
          </button>

          {pickerOpen && (
            <div className="absolute z-30 top-full left-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 max-h-72 overflow-y-auto">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat)}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color ?? undefined }} />
                  {cat.name}
                  {cat.id === tx.category?.id && <Check className="w-3.5 h-3.5 ml-auto text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </td>

        {/* Amounts */}
        <td className="px-4 py-3 text-right font-mono text-sm">
          {debit ? <span className="text-red-600">{formatAmount(tx.withdrawalAmount)}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>}
        </td>
        <td className="px-4 py-3 text-right font-mono text-sm">
          {credit ? <span className="text-green-600">{formatAmount(tx.depositAmount)}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>}
        </td>
        <td className="px-4 py-3 text-right font-mono text-sm text-gray-500 dark:text-gray-400">
          {tx.balance != null ? formatAmount(tx.balance) : '—'}
        </td>

        {/* Reviewed */}
        <td className="px-4 py-3 text-center">
          <button
            onClick={onToggleReviewed}
            className={clsx(
              'w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-colors',
              tx.reviewed
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
            )}
          >
            {tx.reviewed && <Check className="w-3 h-3" />}
          </button>
        </td>

        {/* Note */}
        <td className="px-3 py-2 max-w-[8rem]">
          {editingNote ? (
            <input
              autoFocus
              className="w-full text-xs border rounded px-1 py-0.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onBlur={() => {
                noteMutation.mutate({ id: tx.id, note: noteText })
                setEditingNote(false)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') { noteMutation.mutate({ id: tx.id, note: noteText }); setEditingNote(false) }
                if (e.key === 'Escape') setEditingNote(false)
              }}
            />
          ) : (
            <button
              onClick={() => { setEditingNote(true); setNoteText(tx.note ?? '') }}
              className="text-xs text-gray-400 hover:text-blue-500 truncate max-w-full block text-left"
              title={tx.note ?? 'Add note'}
            >
              {tx.note ? <span className="text-gray-600 dark:text-gray-300">{tx.note}</span> : <MessageSquare size={14} />}
            </button>
          )}
        </td>

        {/* Add to view */}
        <td className="px-2 py-3 text-center relative">
          <button
            onClick={() => setViewPickerOpen(v => !v)}
            className="p-1 text-gray-300 dark:text-gray-600 hover:text-blue-500 rounded transition-colors"
            title="Add to view"
          >
            <Bookmark className="w-4 h-4" />
          </button>
          {viewPickerOpen && (
            <AddToViewPicker txId={tx.id} onClose={() => setViewPickerOpen(false)} />
          )}
        </td>
      </tr>

      {/* Rule creation prompt */}
      {rulePrompt && (
        <tr>
          <td colSpan={9} className="bg-blue-50 border-y border-blue-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-800">
                Create a rule to automatically categorize <strong>{tx.merchantName ?? 'this merchant'}</strong> as{' '}
                <strong>{rulePrompt.categoryName}</strong> in future imports?
              </p>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <button
                  onClick={() => handleRuleDecision(true)}
                  disabled={updateCatMut.isPending}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Yes, create rule
                </button>
                <button
                  onClick={() => handleRuleDecision(false)}
                  disabled={updateCatMut.isPending}
                  className="px-3 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  Just this once
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
