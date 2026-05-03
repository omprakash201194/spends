import React, { useState, useCallback, useEffect } from 'react'
import { Download, MessageSquare, Scissors, Sparkles, X as XIcon, Check as CheckIcon, AlertCircle, Plus, BookmarkPlus } from 'lucide-react'
import { extractTags } from '../utils/tags'
import CategoryRulePicker from '../components/CategoryRulePicker'
import { downloadTransactionsCsv } from '../api/export'
import { getSplits, saveSplits } from '../api/splits'
import InsightCard from '../components/InsightCard'
import TagsPanel from '../components/TagsPanel'
import { getAutoCategorizeSuggestions, type RuleSuggestion } from '../api/insights'
import { createCategory } from '../api/categories'
import { createCategoryRule, reapplyCategoryRules, getCategoryRules } from '../api/categoryRules'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  Search, ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, Check, X, CircleDot,
  Bookmark,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  getTransactions, getTransactionSummary, updateCategory, toggleReviewed, updateNote, bulkUpdateCategory,
  type Transaction, type TransactionFilters,
} from '../api/transactions'
import { getCategories, buildCategoryTree, type Category } from '../api/categories'
import { getBankAccounts } from '../api/bankAccounts'
import { listViews, addTransactionsToView, type ViewResponse } from '../api/views'
import { getAvailableYears } from '../api/reports'
import { useDebounce } from '../hooks/useDebounce'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(n: number) {
  return n === 0 ? '—' : '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(s: string) {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

function renderCategoryOptions(nodes: ReturnType<typeof buildCategoryTree>, depth = 0): React.ReactNode[] {
  const nbsp = '\u00a0\u00a0\u00a0\u00a0' // 4 non-breaking spaces per indent level
  const items: React.ReactNode[] = []
  for (const node of nodes) {
    items.push(
      <option key={node.id} value={node.id}>{nbsp.repeat(depth)}{node.name}</option>
    )
    if (node.children.length > 0) {
      items.push(...renderCategoryOptions(node.children, depth + 1))
    }
  }
  return items
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TransactionPage() {
  const qc = useQueryClient()

  // filters
  const [search, setSearch]         = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [uncategorizedOnly, setUncategorizedOnly] = useState(false)
  const [accountId, setAccountId]       = useState('')
  const [type, setType]                 = useState<'ALL' | 'DEBIT' | 'CREDIT'>('ALL')
  const [dateFrom, setDateFrom]         = useState('')
  const [dateTo, setDateTo]             = useState('')

  // sort
  const [sortBy, setSortBy]   = useState('valueDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // pagination
  const [page, setPage] = useState(0)

  // Seed filters from URL params once on mount (used by chart click-through from dashboards).
  const [searchParams] = useSearchParams()
  const [seededFromUrl, setSeededFromUrl] = useState(false)
  useEffect(() => {
    if (seededFromUrl) return
    const cat = searchParams.get('categoryId')
    const acc = searchParams.get('accountId')
    const df  = searchParams.get('dateFrom')
    const dt  = searchParams.get('dateTo')
    const t   = searchParams.get('type')
    if (cat) setCategoryId(cat)
    if (acc) setAccountId(acc)
    if (df)  setDateFrom(df)
    if (dt)  setDateTo(dt)
    if (t === 'DEBIT' || t === 'CREDIT' || t === 'ALL') setType(t)
    setSeededFromUrl(true)
  }, [searchParams, seededFromUrl])

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
    uncategorizedOnly: uncategorizedOnly || undefined,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => getTransactions(filters),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  })

  const summaryFilters = { search: debouncedSearch || undefined, categoryId: categoryId || undefined, accountId: accountId || undefined, type, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, uncategorizedOnly: uncategorizedOnly || undefined }
  const { data: summary } = useQuery({
    queryKey: ['transactions-summary', summaryFilters],
    queryFn: () => getTransactionSummary(summaryFilters),
    enabled: !!(debouncedSearch || categoryId || accountId || type !== 'ALL' || dateFrom || dateTo || uncategorizedOnly),
    staleTime: 30_000,
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

  const { data: rules = [] } = useQuery({
    queryKey: ['category-rules'],
    queryFn: getCategoryRules,
    staleTime: 30_000,
  })

  const { data: availableYears = [] } = useQuery({
    queryKey: ['available-years'],
    queryFn: getAvailableYears,
    staleTime: Infinity,
  })

  const aiRuleCategoryIds = new Set(rules.filter(r => r.aiGenerated).map(r => r.categoryId))

  const toggleReviewedMut = useMutation({
    mutationFn: toggleReviewed,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })

  // ── Bulk selection ────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkCategoryId, setBulkCategoryId] = useState('')

  useEffect(() => { setSelectedIds(new Set()) }, [page])

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const toggleAll = () => {
    if (data?.content && selectedIds.size === data.content.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(data?.content.map(tx => tx.id) ?? []))
    }
  }

  const bulkMutation = useMutation({
    mutationFn: ({ ids, categoryId }: { ids: string[]; categoryId: string }) =>
      bulkUpdateCategory(ids, categoryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      setSelectedIds(new Set())
      setBulkCategoryId('')
    },
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
    setSearch(''); setCategoryId(''); setAccountId(''); setUncategorizedOnly(false)
    setType('ALL'); setDateFrom(''); setDateTo(''); setPage(0)
  }

  const hasFilters = search || categoryId || accountId || type !== 'ALL' || dateFrom || dateTo || uncategorizedOnly

  const activeYear = (() => {
    if (!dateFrom || !dateTo) return null
    const y = dateFrom.slice(0, 4)
    if (dateTo === `${y}-12-31` && dateFrom === `${y}-01-01`) return Number(y)
    return null
  })()

  const selectYear = (year: number) => {
    setDateFrom(`${year}-01-01`)
    setDateTo(`${year}-12-31`)
    setPage(0)
  }

  const [exporting, setExporting] = useState(false)
  const [splitTxId, setSplitTxId] = useState<string | null>(null)
  const [searchRulePickerOpen, setSearchRulePickerOpen] = useState(false)

  // ── Auto-categorize modal ─────────────────────────────────────────────────
  const [showAutoCat, setShowAutoCat]             = useState(false)
  const [autoCatLoading, setAutoCatLoading]       = useState(false)
  const [autoCatError, setAutoCatError]           = useState<string | null>(null)
  const [suggestions, setSuggestions]             = useState<RuleSuggestion[]>([])
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set())
  const [overrideCategoryId, setOverrideCategoryId]   = useState<Record<number, string>>({})
  const [autoCatApplying, setAutoCatApplying]     = useState(false)
  const [autoCatResult, setAutoCatResult]         = useState<string | null>(null)

  const openAutoCat = async () => {
    setShowAutoCat(true)
    setAutoCatLoading(true)
    setAutoCatError(null)
    setSuggestions([])
    setSelectedSuggestions(new Set())
    setOverrideCategoryId({})
    setAutoCatResult(null)
    try {
      const res = await getAutoCategorizeSuggestions()
      setSuggestions(res.suggestions)
      setSelectedSuggestions(new Set(res.suggestions.map((_, i) => i)))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to get suggestions'
      setAutoCatError(msg)
    } finally {
      setAutoCatLoading(false)
    }
  }

  const applyAutoCat = async () => {
    setAutoCatApplying(true)
    try {
      let newCatCount = 0
      let ruleCount = 0
      // Re-fetch categories so we can resolve new ones
      const freshCats = await import('../api/categories').then(m => m.getCategories())
      const nameToId: Record<string, string> = {}
      for (const c of freshCats) nameToId[c.name] = c.id

      for (const idx of Array.from(selectedSuggestions).sort((a, b) => a - b)) {
        const s = suggestions[idx]
        const overrideId = overrideCategoryId[idx]

        let categoryId = overrideId || s.existingCategoryId || null

        // Create new category if needed
        if (!categoryId && s.suggestNewCategoryName) {
          if (nameToId[s.suggestNewCategoryName]) {
            categoryId = nameToId[s.suggestNewCategoryName]
          } else {
            const parentId = s.suggestParentCategoryName ? nameToId[s.suggestParentCategoryName] ?? null : null
            const newCat = await createCategory(
              s.suggestNewCategoryName,
              s.suggestColor ?? '#94a3b8',
              parentId,
            )
            nameToId[newCat.name] = newCat.id
            categoryId = newCat.id
            newCatCount++
          }
        }

        if (categoryId) {
          await createCategoryRule(s.pattern, categoryId, 0, true)
          ruleCount++
        }
      }

      const reapply = await reapplyCategoryRules()
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setAutoCatResult(
        `${ruleCount} rule${ruleCount !== 1 ? 's' : ''} created` +
        (newCatCount > 0 ? `, ${newCatCount} new categor${newCatCount !== 1 ? 'ies' : 'y'}` : '') +
        `, ${reapply.updated} transaction${reapply.updated !== 1 ? 's' : ''} updated.`
      )
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to apply'
      setAutoCatError(msg)
    } finally {
      setAutoCatApplying(false)
    }
  }

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
        uncategorizedOnly: uncategorizedOnly || undefined,
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
      <div className="flex flex-wrap gap-2 mb-2">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            placeholder='Search… use "and" / "or" between terms, -word to exclude'
            className="w-full pl-8 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(0) }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
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
          value={uncategorizedOnly ? '__UNCAT__' : categoryId}
          onChange={(e) => {
            const v = e.target.value
            if (v === '__UNCAT__') {
              setUncategorizedOnly(true); setCategoryId(''); setPage(0)
            } else {
              setUncategorizedOnly(false); setCategoryId(v); setPage(0)
            }
          }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
        >
          <option value="">All categories</option>
          <option value="__UNCAT__">Uncategorized</option>
          <option value="__SEP__" disabled>──────────</option>
          {renderCategoryOptions(buildCategoryTree(categories))}
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

      {/* Year quick-filter chips */}
      {availableYears.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {availableYears.map(year => (
            <button
              key={year}
              onClick={() => activeYear === year ? (setDateFrom(''), setDateTo(''), setPage(0)) : selectYear(year)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${activeYear === year ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'}`}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {/* Active filter chips + Clear all */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {search && (() => {
            const isOr = / or /i.test(search)
            const isAnd = / and /i.test(search)
            const operator = isOr ? 'or' : 'and'
            const terms = isOr
              ? search.split(/ or /i)
              : isAnd ? search.split(/ and /i)
              : [search]
            return terms.map((term, i) => {
              const t = term.trim()
              const isNot = t.startsWith('-') || t.startsWith('!')
              const word = isNot ? t.slice(1) : t
              const removeTerm = () => {
                const remaining = terms.filter((_, j) => j !== i).map(s => s.trim()).filter(Boolean)
                setSearch(remaining.join(` ${operator} `))
                setPage(0)
              }
              return (
                <React.Fragment key={i}>
                  {i > 0 && <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500">{operator}</span>}
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-mono ${isNot ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'}`}>
                    {isNot && <span className="font-bold mr-0.5">NOT</span>}
                    {word}
                    <button onClick={removeTerm} className="opacity-60 hover:opacity-100 ml-0.5">×</button>
                  </span>
                </React.Fragment>
              )
            })
          })()}
          {categoryId && <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">category<button onClick={() => { setCategoryId(''); setPage(0) }} className="opacity-60 hover:opacity-100">×</button></span>}
          {uncategorizedOnly && <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">uncategorized<button onClick={() => { setUncategorizedOnly(false); setPage(0) }} className="opacity-60 hover:opacity-100">×</button></span>}
          {accountId && <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">account<button onClick={() => { setAccountId(''); setPage(0) }} className="opacity-60 hover:opacity-100">×</button></span>}
          {type !== 'ALL' && <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{type.toLowerCase()}<button onClick={() => { setType('ALL'); setPage(0) }} className="opacity-60 hover:opacity-100">×</button></span>}
          {dateFrom && <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">from {dateFrom}<button onClick={() => { setDateFrom(''); setPage(0) }} className="opacity-60 hover:opacity-100">×</button></span>}
          {dateTo && <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">to {dateTo}<button onClick={() => { setDateTo(''); setPage(0) }} className="opacity-60 hover:opacity-100">×</button></span>}
          <div className="ml-auto flex items-center gap-2">
            {debouncedSearch && (
              <div className="relative">
                <button
                  onClick={() => setSearchRulePickerOpen(o => !o)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  title="Save search as category rule"
                >
                  <BookmarkPlus className="w-3 h-3" /> Save as rule
                </button>
                {searchRulePickerOpen && (
                  <CategoryRulePicker
                    tag={debouncedSearch}
                    categories={categories}
                    onClose={() => setSearchRulePickerOpen(false)}
                    onApplied={() => setSearchRulePickerOpen(false)}
                    align="right"
                  />
                )}
              </div>
            )}
            <button onClick={resetFilters} className="text-xs text-red-500 dark:text-red-400 hover:underline flex items-center gap-1">
              <X className="w-3 h-3" /> Clear all
            </button>
          </div>
        </div>
      )}

      {/* Filter summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Credit</p>
            <p className="text-base font-semibold text-green-600">₹{summary.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Debit</p>
            <p className="text-base font-semibold text-red-600">₹{summary.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Net</p>
            <p className={`text-base font-semibold ${summary.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.net < 0 ? '-' : ''}₹{Math.abs(summary.net).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      {/* Table + InsightCard sidebar */}
      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-4 lg:items-start">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={!!data?.content.length && selectedIds.size === data.content.length}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
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
                <tr><td colSpan={10} className="text-center py-16 text-gray-400 dark:text-gray-500">Loading…</td></tr>
              ) : !data || data.content.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-16 text-gray-400 dark:text-gray-500">No transactions found</td></tr>
              ) : data.content.map((tx) => (
                <TxRow
                  key={tx.id}
                  tx={tx}
                  categories={categories}
                  aiRuleCategoryIds={aiRuleCategoryIds}
                  checked={selectedIds.has(tx.id)}
                  onToggle={() => toggleSelect(tx.id)}
                  onToggleReviewed={() => toggleReviewedMut.mutate(tx.id)}
                  onCategoryUpdated={() => qc.invalidateQueries({ queryKey: ['transactions'] })}
                  onSplit={() => setSplitTxId(tx.id)}
                  onTagClick={(tag) => { setSearch(prev => { const already = prev.toLowerCase().split(/ and | or /i).map(t => t.trim()); return already.includes(tag) ? prev : prev.trim() ? `${prev.trim()} and ${tag}` : tag }); setPage(0) }}
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

      <div className="mt-4 lg:mt-0 lg:sticky lg:top-6 space-y-3 max-h-[calc(100vh-6rem)] overflow-y-auto">
        <InsightCard type="TRANSACTIONS" label="Analyse My Spending" />
        <button
          onClick={openAutoCat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Auto-categorize with AI
        </button>
        <TagsPanel
          onTagClick={(tag) => { setSearch(prev => { const already = prev.toLowerCase().split(/ and | or /i).map(t => t.trim()); return already.includes(tag) ? prev : prev.trim() ? `${prev.trim()} and ${tag}` : tag }); setPage(0) }}
          categories={categories}
        />
      </div>
      </div>{/* end sidebar grid */}

      {/* Split modal */}
      {splitTxId && (
        <SplitModal
          txId={splitTxId}
          categories={categories}
          onClose={() => setSplitTxId(null)}
        />
      )}

      {/* Auto-categorize modal */}
      {showAutoCat && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                  Auto-categorize with AI
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Review suggested rules before applying
                </p>
              </div>
              <button onClick={() => setShowAutoCat(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {autoCatLoading && (
                <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  Analysing your transactions…
                </div>
              )}
              {autoCatError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {autoCatError}
                </div>
              )}
              {autoCatResult && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-800 dark:text-green-200">
                  {autoCatResult}
                </div>
              )}
              {!autoCatLoading && suggestions.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{selectedSuggestions.size} of {suggestions.length} selected</span>
                    <button
                      onClick={() => setSelectedSuggestions(
                        selectedSuggestions.size === suggestions.length
                          ? new Set()
                          : new Set(suggestions.map((_, i) => i))
                      )}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {selectedSuggestions.size === suggestions.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {suggestions.map((s, i) => {
                      const isNew = !s.existingCategoryId && !!s.suggestNewCategoryName
                      const checked = selectedSuggestions.has(i)
                      return (
                        <div
                          key={i}
                          onClick={() => setSelectedSuggestions(prev => {
                            const next = new Set(prev)
                            next.has(i) ? next.delete(i) : next.add(i)
                            return next
                          })}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                            checked
                              ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'}`}>
                            {checked && <CheckIcon className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <code className="text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded flex-shrink-0">
                            {s.pattern}
                          </code>
                          <span className="text-xs text-gray-400 flex-shrink-0">→</span>
                          <div className="flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                            <select
                              value={overrideCategoryId[i] ?? s.existingCategoryId ?? ''}
                              onChange={e => setOverrideCategoryId(prev => ({ ...prev, [i]: e.target.value }))}
                              className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                            >
                              <option value="">-- pick a category --</option>
                              {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                          {isNew && !overrideCategoryId[i] && (
                            <span className="text-xs bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                              New: {s.suggestNewCategoryName}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
              {!autoCatLoading && !autoCatError && suggestions.length === 0 && !autoCatResult && (
                <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                  No suggestions — try importing more transactions first.
                </p>
              )}
            </div>

            {/* Footer */}
            {!autoCatLoading && suggestions.length > 0 && !autoCatResult && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  New categories will be created automatically before rules are saved.
                </p>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => setShowAutoCat(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800">
                    Cancel
                  </button>
                  <button
                    onClick={applyAutoCat}
                    disabled={autoCatApplying || selectedSuggestions.size === 0}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {autoCatApplying ? 'Applying…' : `Apply ${selectedSuggestions.size} rules`}
                  </button>
                </div>
              </div>
            )}
            {autoCatResult && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                <button onClick={() => setShowAutoCat(false)} className="px-4 py-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-sm font-medium rounded-lg">
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 shadow-xl rounded-xl px-6 py-3 flex items-center gap-4 border border-gray-200 dark:border-gray-700 z-50">
          <span className="text-sm font-medium dark:text-white">{selectedIds.size} selected</span>
          <select
            value={bulkCategoryId}
            onChange={e => setBulkCategoryId(e.target.value)}
            className="text-sm border rounded px-2 py-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="">Select category…</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
            ))}
          </select>
          <button
            disabled={!bulkCategoryId || bulkMutation.isPending}
            onClick={() => bulkMutation.mutate({ ids: Array.from(selectedIds), categoryId: bulkCategoryId })}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded disabled:opacity-50"
          >
            Apply
          </button>
          <button
            onClick={() => { setSelectedIds(new Set()); setBulkCategoryId('') }}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            Cancel
          </button>
        </div>
      )}
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

function TxRow({ tx, categories, aiRuleCategoryIds, checked, onToggle, onToggleReviewed, onCategoryUpdated, onSplit, onTagClick }: {
  tx: Transaction
  categories: Category[]
  aiRuleCategoryIds: Set<string>
  checked: boolean
  onToggle: () => void
  onToggleReviewed: () => void
  onCategoryUpdated: () => void
  onSplit: () => void
  onTagClick: (tag: string) => void
}) {
  const qc = useQueryClient()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [rulePrompt, setRulePrompt] = useState<{ categoryId: string; categoryName: string } | null>(null)
  const [viewPickerOpen, setViewPickerOpen] = useState(false)
  const [editingNote, setEditingNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [tagPickerTag, setTagPickerTag] = useState<string | null>(null)

  const noteMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => updateNote(id, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })

  const updateCatMut = useMutation({
    mutationFn: ({ catId, createRule, pattern }: { catId: string | null; createRule: boolean; pattern?: string }) =>
      updateCategory(tx.id, catId, createRule, pattern),
    onSuccess: () => { onCategoryUpdated(); setPickerOpen(false); setRulePrompt(null) },
  })

  const handleSelectCategory = (cat: Category | null) => {
    if ((cat?.id ?? null) === (tx.category?.id ?? null)) { setPickerOpen(false); return }
    if (cat === null) {
      updateCatMut.mutate({ catId: null, createRule: false })
      return
    }
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
        {/* Checkbox */}
        <td className="px-3 py-2">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            className="rounded"
          />
        </td>

        {/* Date */}
        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
          {formatDate(tx.valueDate)}
        </td>

        {/* Merchant + remarks + tag chips */}
        <td className="px-4 py-3 max-w-xs">
          <p className="font-medium text-gray-900 dark:text-white truncate">
            {tx.merchantName ?? tx.rawRemarks?.substring(0, 40)}
          </p>
          {tx.merchantName && (
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{tx.rawRemarks?.substring(0, 60)}</p>
          )}
          {(() => {
            const tags = extractTags(tx.rawRemarks).slice(0, 5)
            if (tags.length === 0) return null
            return (
              <div className="flex flex-wrap gap-1 mt-1">
                {tags.map(tag => (
                  <div key={tag} className="relative flex items-center">
                    <button
                      onClick={() => onTagClick(tag)}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                      {tag}
                    </button>
                    <button
                      onClick={() => setTagPickerTag(tagPickerTag === tag ? null : tag)}
                      className="ml-0.5 text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                      title={`Assign "${tag}" to category`}
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                    {tagPickerTag === tag && (
                      <CategoryRulePicker
                        tag={tag}
                        categories={categories}
                        onClose={() => setTagPickerTag(null)}
                        onApplied={() => setTagPickerTag(null)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )
          })()}
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
            {tx.account.bankName}
            {tx.account.accountNumberMasked ? ` · ${tx.account.accountNumberMasked}` : ''}
          </p>
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
            <CircleDot className="w-3 h-3 flex-shrink-0" />
            {tx.category?.parentId && (
              <span className="opacity-60">
                {categories.find(c => c.id === tx.category!.parentId)?.name ?? ''}
                {' ›'}
              </span>
            )}
            {tx.category?.name ?? 'Uncategorized'}
            {tx.category && !tx.reviewed && aiRuleCategoryIds.has(tx.category.id) && (
              <Sparkles className="w-3 h-3 opacity-80" />
            )}
          </button>

          {pickerOpen && (
            <div className="absolute z-30 top-full left-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 max-h-72 overflow-y-auto">
              <button
                onClick={() => handleSelectCategory(null)}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700"
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-gray-300 dark:border-gray-500" />
                Uncategorized
                {!tx.category && <Check className="w-3.5 h-3.5 ml-auto text-blue-600" />}
              </button>
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

        {/* Actions: split + add to view */}
        <td className="px-2 py-3 text-center relative">
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={onSplit}
              className="p-1 text-gray-300 dark:text-gray-600 hover:text-purple-500 dark:hover:text-purple-400 rounded transition-colors"
              title="Split transaction"
            >
              <Scissors className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewPickerOpen(v => !v)}
              className="p-1 text-gray-300 dark:text-gray-600 hover:text-blue-500 rounded transition-colors"
              title="Add to view"
            >
              <Bookmark className="w-4 h-4" />
            </button>
          </div>
          {viewPickerOpen && (
            <AddToViewPicker txId={tx.id} onClose={() => setViewPickerOpen(false)} />
          )}
        </td>
      </tr>

      {/* Rule creation prompt */}
      {rulePrompt && (
        <tr>
          <td colSpan={10} className="bg-blue-50 border-y border-blue-100 px-4 py-3">
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
                <button
                  onClick={() => setRulePrompt(null)}
                  disabled={updateCatMut.isPending}
                  className="px-3 py-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Split Modal ───────────────────────────────────────────────────────────────

function SplitModal({ txId, categories, onClose }: {
  txId: string
  categories: Category[]
  onClose: () => void
}) {
  const qc = useQueryClient()

  const { data: existingSplits = [] } = useQuery({
    queryKey: ['splits', txId],
    queryFn: () => getSplits(txId),
  })

  const [rows, setRows] = useState<{ categoryId: string; amount: string; note: string }[]>([
    { categoryId: '', amount: '', note: '' },
    { categoryId: '', amount: '', note: '' },
  ])

  useEffect(() => {
    if (existingSplits.length > 0) {
      setRows(existingSplits.map(s => ({
        categoryId: s.categoryId ?? '',
        amount: String(s.amount),
        note: s.note ?? '',
      })))
    }
  }, [existingSplits])

  const saveMutation = useMutation({
    mutationFn: () => saveSplits(txId, rows
      .filter(r => r.amount && parseFloat(r.amount) > 0)
      .map(r => ({
        categoryId: r.categoryId || undefined,
        amount: parseFloat(r.amount),
        note: r.note || undefined,
      }))
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['splits', txId] })
      onClose()
    },
  })

  const updateRow = (i: number, field: string, value: string) =>
    setRows(rows.map((r, j) => j === i ? { ...r, [field]: value } : r))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Split Transaction</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Divide this transaction across multiple categories
          </p>
        </div>

        <div className="p-5 space-y-3 max-h-80 overflow-y-auto">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select
                value={row.categoryId}
                onChange={e => updateRow(i, 'categoryId', e.target.value)}
                className="flex-1 text-xs border rounded-lg px-2 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">Uncategorized</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Amount"
                value={row.amount}
                onChange={e => updateRow(i, 'amount', e.target.value)}
                className="w-24 text-xs border rounded-lg px-2 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <input
                placeholder="Note"
                value={row.note}
                onChange={e => updateRow(i, 'note', e.target.value)}
                className="flex-1 text-xs border rounded-lg px-2 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              {rows.length > 1 && (
                <button
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  className="text-red-400 hover:text-red-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <button
            onClick={() => setRows([...rows, { categoryId: '', amount: '', note: '' }])}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            + Add row
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
            >
              Cancel
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-1.5 rounded-lg disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Splits'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
