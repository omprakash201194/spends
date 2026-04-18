import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, X, Trash2, Tag, Sliders, Check, ChevronDown, ChevronRight, Sparkles,
  Briefcase, ShoppingCart, Utensils, Car, Home, Heart, Music, Zap,
  TrendingUp, DollarSign, Gift, Coffee, Plane, Book, Smartphone,
  Baby, Dumbbell, Dog, Wallet, Bus, Fuel, Pizza, Shirt,
  type LucideIcon,
} from 'lucide-react'
import {
  getCategories, createCategory, updateCategory, deleteCategory,
  buildCategoryTree, flattenWithDepth,
  type Category, type CategoryNode,
} from '../api/categories'
import {
  getCategoryRules, createCategoryRule, updateCategoryRule, deleteCategoryRule,
  reapplyCategoryRules,
  type CategoryRule,
} from '../api/categoryRules'

// ── Colour palette for custom categories ─────────────────────────────────────

const COLOUR_SWATCHES = [
  '#f87171', '#fb923c', '#fbbf24', '#a3e635',
  '#34d399', '#22d3ee', '#60a5fa', '#a78bfa',
  '#f472b6', '#94a3b8', '#6b7280', '#1d4ed8',
]

// ── Icon picker ───────────────────────────────────────────────────────────────

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  'shopping-cart': ShoppingCart,
  utensils: Utensils,
  car: Car,
  home: Home,
  heart: Heart,
  music: Music,
  zap: Zap,
  'trending-up': TrendingUp,
  'dollar-sign': DollarSign,
  gift: Gift,
  coffee: Coffee,
  plane: Plane,
  book: Book,
  smartphone: Smartphone,
  baby: Baby,
  dumbbell: Dumbbell,
  dog: Dog,
  wallet: Wallet,
  bus: Bus,
  fuel: Fuel,
  pizza: Pizza,
  shirt: Shirt,
}

export function CategoryIcon({ name, className }: { name: string | null; className?: string }) {
  if (!name) return null
  const Icon = CATEGORY_ICONS[name]
  if (!Icon) return null
  return <Icon className={className ?? 'w-4 h-4'} />
}

function IconPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      <button
        type="button"
        title="No icon"
        onClick={() => onChange(null)}
        className={`w-7 h-7 rounded-md border flex items-center justify-center text-xs transition-colors ${
          value === null
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-600'
            : 'border-gray-200 dark:border-gray-600 hover:border-gray-400 text-gray-400'
        }`}
      >
        ∅
      </button>
      {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
        <button
          key={key}
          type="button"
          title={key}
          onClick={() => onChange(key)}
          className={`w-7 h-7 rounded-md border flex items-center justify-center transition-colors ${
            value === key
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-600'
              : 'border-gray-200 dark:border-gray-600 hover:border-gray-400 text-gray-500 dark:text-gray-400'
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'categories' | 'rules'

export default function CategoriesPage() {
  const [tab, setTab] = useState<Tab>('categories')
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          Categories &amp; Rules
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Organise spending categories and auto-classification rules
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl w-fit">
        {([
          { id: 'categories', label: 'Categories', icon: Tag     },
          { id: 'rules',      label: 'Rules',       icon: Sliders },
        ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'categories' && <CategoriesTab />}
      {tab === 'rules'      && <RulesTab />}
    </div>
  )
}

// ── Tab: Categories ───────────────────────────────────────────────────────────

function CategoriesTab() {
  const qc = useQueryClient()
  const { data: cats = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  })

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createParentId, setCreateParentId] = useState<string | null>(null)
  const [newName, setNewName]   = useState('')
  const [newColor, setNewColor] = useState(COLOUR_SWATCHES[5])
  const [newIcon, setNewIcon]   = useState<string | null>(null)
  const [editId, setEditId]           = useState<string | null>(null)
  const [editName, setEditName]       = useState('')
  const [editColor, setEditColor]     = useState('')
  const [editIcon, setEditIcon]       = useState<string | null>(null)
  const [editParentId, setEditParentId] = useState<string>('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const createMutation = useMutation({
    mutationFn: () => createCategory(newName.trim(), newColor, createParentId, newIcon),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      setNewName('')
      setNewColor(COLOUR_SWATCHES[5])
      setNewIcon(null)
      setShowCreateForm(false)
      // Auto-expand parent so user sees the new child
      if (created.parentId) setExpandedIds(prev => new Set([...prev, created.parentId!]))
      setCreateParentId(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (id: string) => updateCategory(
      id, editName.trim(), editColor,
      editParentId || null,           // new parent (null = top-level)
      editParentId === '',            // clearParent when explicitly set to top-level
      editIcon,
    ),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      setEditId(null)
      if (updated.parentId) setExpandedIds(prev => new Set([...prev, updated.parentId!]))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })

  const startEdit = (c: Category) => {
    setEditId(c.id)
    setEditName(c.name)
    setEditColor(c.color ?? COLOUR_SWATCHES[5])
    setEditIcon(c.icon ?? null)
    setEditParentId(c.parentId ?? '')
  }

  const getDescendantIds = (id: string): Set<string> => {
    const result = new Set<string>()
    const queue = [id]
    while (queue.length > 0) {
      const cur = queue.shift()!
      cats.filter(c => c.parentId === cur).forEach(c => { result.add(c.id); queue.push(c.id) })
    }
    return result
  }
  const openCreateUnder = (parentId: string) => {
    setCreateParentId(parentId)
    setShowCreateForm(true)
    setExpandedIds(prev => new Set([...prev, parentId]))
  }
  const toggleExpand = (id: string) => setExpandedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const allTree = buildCategoryTree(cats)
  const customCount = cats.filter(c => !c.system).length

  const renderNode = (node: CategoryNode, depth: number): React.ReactNode => {
    const hasChildren = node.children.length > 0
    const isExpanded = expandedIds.has(node.id)
    const isEditing = editId === node.id

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 group"
          style={{ paddingLeft: `${12 + depth * 20}px`, paddingRight: '12px' }}
        >
          <button
            type="button"
            onClick={() => toggleExpand(node.id)}
            className={`w-4 h-4 flex items-center justify-center text-gray-400 flex-shrink-0 ${!hasChildren ? 'invisible' : ''}`}
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>

          <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: node.color ?? '#94a3b8' }}>
            {node.icon && <CategoryIcon name={node.icon} className="w-3 h-3 text-white" />}
          </div>

          {isEditing ? (
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="flex-1 px-2 py-0.5 text-sm border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                  onKeyDown={e => { if (e.key === 'Enter') updateMutation.mutate(node.id); if (e.key === 'Escape') setEditId(null) }}
                  autoFocus
                />
                <ColourPicker value={editColor} onChange={setEditColor} />
                <button type="button" onClick={() => updateMutation.mutate(node.id)} disabled={updateMutation.isPending} className="text-blue-500 hover:text-blue-600 disabled:opacity-50"><Check className="w-4 h-4" /></button>
                <button type="button" onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-4 h-4" /></button>
              </div>
              <IconPicker value={editIcon} onChange={setEditIcon} />
              {/* Parent selector */}
              {(() => {
                const excluded = getDescendantIds(node.id)
                excluded.add(node.id)
                const eligible = flattenWithDepth(buildCategoryTree(cats)).filter(({ category: c }) => !excluded.has(c.id))
                return (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">Move under:</span>
                    <select
                      value={editParentId}
                      onChange={e => setEditParentId(e.target.value)}
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    >
                      <option value="">None (top-level)</option>
                      {eligible.map(({ category: c, depth }) => (
                        <option key={c.id} value={c.id}>
                          {'\u00a0'.repeat(depth * 3)}{c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })()}
            </div>
          ) : (
            <>
              <span className={`flex-1 text-sm ${node.system ? 'text-gray-600 dark:text-gray-300' : 'text-gray-800 dark:text-gray-100 font-medium'}`}>
                {node.name}
              </span>
              {!node.system && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-medium mr-1 flex-shrink-0">
                  custom
                </span>
              )}
              {depth > 0 && node.system && (
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono mr-1">L{depth + 1}</span>
              )}
              <div className="hidden group-hover:flex items-center gap-1">
                <button
                  type="button"
                  title="Add child category"
                  onClick={() => openCreateUnder(node.id)}
                  className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 p-0.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                {!node.system && (
                  <>
                    <button type="button" onClick={() => startEdit(node)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => deleteMutation.mutate(node.id)} className="text-red-400 hover:text-red-600 p-0.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
        {hasChildren && isExpanded && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  if (isLoading) return <div className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">Loading…</div>

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">All Categories</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {customCount > 0 ? `${customCount} custom · ` : ''}System categories cannot be modified — hover any row to add a subcategory
          </p>
        </div>
        {!showCreateForm && (
          <button
            type="button"
            onClick={() => { setCreateParentId(null); setShowCreateForm(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Category
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="flex gap-2 mb-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Category name…"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
              onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) createMutation.mutate(); if (e.key === 'Escape') { setShowCreateForm(false); setCreateParentId(null) } }}
              autoFocus
            />
            <div className="w-9 h-9 rounded-lg border-2 border-gray-300 dark:border-gray-500 flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: newColor }}>
              {newIcon && <CategoryIcon name={newIcon} className="w-4 h-4 text-white" />}
            </div>
          </div>
          <ColourPicker value={newColor} onChange={setNewColor} />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 mb-1">Icon</p>
          <IconPicker value={newIcon} onChange={setNewIcon} />
          <div className="mt-3">
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Parent category (optional)</label>
            <select
              value={createParentId ?? ''}
              onChange={e => setCreateParentId(e.target.value || null)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">None (top-level)</option>
              {flattenWithDepth(buildCategoryTree(cats)).map(({ category: c, depth }) => (
                <option key={c.id} value={c.id}>
                  {'\u00a0\u00a0\u00a0\u00a0'.repeat(depth)}{c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={() => createMutation.mutate()} disabled={!newName.trim() || createMutation.isPending}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50">
              Create
            </button>
            <button type="button" onClick={() => { setShowCreateForm(false); setCreateParentId(null) }}
              className="px-3 py-1.5 text-gray-500 dark:text-gray-400 text-xs hover:text-gray-700 dark:hover:text-gray-200">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-0.5">
        {allTree.map(node => renderNode(node, 0))}
      </div>
    </div>
  )
}

// ── Tab: Rules ────────────────────────────────────────────────────────────────

function RulesTab() {
  const qc = useQueryClient()
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['category-rules'],
    queryFn: getCategoryRules,
  })
  const { data: cats = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  })

  const [showForm, setShowForm]       = useState(false)
  const [newPattern, setNewPattern]   = useState('')
  const [newCatId, setNewCatId]       = useState('')
  const [newPriority, setNewPriority] = useState(0)

  const [editId, setEditId]             = useState<string | null>(null)
  const [editPattern, setEditPattern]   = useState('')
  const [editCatId, setEditCatId]       = useState('')
  const [editPriority, setEditPriority] = useState(0)

  const [showReapplyPrompt, setShowReapplyPrompt] = useState(false)
  const [reapplyResult, setReapplyResult]         = useState<number | null>(null)

  const reapplyMutation = useMutation({
    mutationFn: reapplyCategoryRules,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setShowReapplyPrompt(false)
      setReapplyResult(result.updated)
      setTimeout(() => setReapplyResult(null), 5000)
    },
  })

  const createMutation = useMutation({
    mutationFn: () => createCategoryRule(newPattern.trim(), newCatId, newPriority),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['category-rules'] })
      setNewPattern('')
      setNewCatId('')
      setNewPriority(0)
      setShowForm(false)
      setShowReapplyPrompt(true)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (id: string) => updateCategoryRule(id, {
      pattern: editPattern.trim(),
      categoryId: editCatId,
      priority: editPriority,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['category-rules'] })
      setEditId(null)
      setShowReapplyPrompt(true)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCategoryRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['category-rules'] }),
  })

  const startEdit = (r: CategoryRule) => {
    setEditId(r.id)
    setEditPattern(r.pattern)
    setEditCatId(r.categoryId)
    setEditPriority(r.priority)
  }

  if (isLoading) return <div className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">Loading…</div>

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Categorization Rules</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Keywords matched against transaction remarks — higher priority wins
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Rule
        </button>
      </div>

      {/* Reapply prompt */}
      {showReapplyPrompt && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between gap-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Apply this rule to your existing transactions?
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => reapplyMutation.mutate()}
              disabled={reapplyMutation.isPending}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {reapplyMutation.isPending ? 'Applying…' : 'Yes, apply'}
            </button>
            <button
              onClick={() => setShowReapplyPrompt(false)}
              className="px-3 py-1.5 text-xs text-blue-700 dark:text-blue-300 hover:underline"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Reapply result toast */}
      {reapplyResult !== null && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-800 dark:text-green-200">
          {reapplyResult === 0
            ? 'No transactions changed — they were already categorized correctly.'
            : `${reapplyResult} transaction${reapplyResult === 1 ? '' : 's'} updated.`}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
          <RuleForm
            pattern={newPattern} setPattern={setNewPattern}
            catId={newCatId}    setCatId={setNewCatId}
            priority={newPriority} setPriority={setNewPriority}
            cats={cats}
            onSubmit={() => createMutation.mutate()}
            onCancel={() => setShowForm(false)}
            isPending={createMutation.isPending}
            submitLabel="Create"
          />
        </div>
      )}

      {rules.length === 0 && !showForm ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
          No rules yet. Rules are created automatically when you re-categorize a transaction,
          or you can add them manually above.
        </p>
      ) : (
        <div className="space-y-1">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 px-3 pb-1 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
            <span>Pattern</span>
            <span>Category</span>
            <span>Priority</span>
            <span />
          </div>

          {rules.map(rule => (
            <div key={rule.id}>
              {editId === rule.id ? (
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 mb-1">
                  <RuleForm
                    pattern={editPattern} setPattern={setEditPattern}
                    catId={editCatId}    setCatId={setEditCatId}
                    priority={editPriority} setPriority={setEditPriority}
                    cats={cats}
                    onSubmit={() => updateMutation.mutate(rule.id)}
                    onCancel={() => setEditId(null)}
                    isPending={updateMutation.isPending}
                    submitLabel="Save"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 items-center px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 group">
                  <span className="text-sm font-mono text-gray-700 dark:text-gray-200 truncate">{rule.pattern}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: rule.categoryColor ?? '#94a3b8' }}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{rule.categoryName}</span>
                    {rule.aiGenerated && (
                      <span title="AI-generated rule">
                        <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-violet-500" />
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-400 dark:text-gray-500 text-right tabular-nums">{rule.priority}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(rule)}
                      className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(rule.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1 text-gray-400 hover:text-red-500 rounded disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function ColourPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOUR_SWATCHES.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full transition-transform ${value === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400 dark:ring-offset-gray-700' : 'hover:scale-110'}`}
          style={{ backgroundColor: c }}
          title={c}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-6 h-6 rounded-full cursor-pointer border-0 p-0 bg-transparent"
        title="Custom colour"
      />
    </div>
  )
}

function RuleForm({
  pattern, setPattern, catId, setCatId, priority, setPriority,
  cats, onSubmit, onCancel, isPending, submitLabel,
}: {
  pattern: string; setPattern: (v: string) => void
  catId: string;   setCatId:   (v: string) => void
  priority: number; setPriority: (v: number) => void
  cats: Category[]
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
  submitLabel: string
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          autoFocus
          type="text"
          value={pattern}
          onChange={e => setPattern(e.target.value)}
          placeholder="keyword or phrase…"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
          onKeyDown={e => {
            if (e.key === 'Enter' && pattern.trim() && catId) onSubmit()
            if (e.key === 'Escape') onCancel()
          }}
        />
        <select
          value={catId}
          onChange={e => setCatId(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
        >
          <option value="">— Select category —</option>
          {cats.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input
          type="number"
          value={priority}
          onChange={e => setPriority(Number(e.target.value))}
          placeholder="Priority (higher = first)"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          disabled={!pattern.trim() || !catId || isPending}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
