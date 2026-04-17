import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, X, Trash2, Tag, Sliders, Check, ChevronDown, ChevronRight } from 'lucide-react'
import {
  getCategories, createCategory, updateCategory, deleteCategory,
  buildCategoryTree,
  type Category, type CategoryNode,
} from '../api/categories'
import {
  getCategoryRules, createCategoryRule, updateCategoryRule, deleteCategoryRule,
  type CategoryRule,
} from '../api/categoryRules'

// ── Colour palette for custom categories ─────────────────────────────────────

const COLOUR_SWATCHES = [
  '#f87171', '#fb923c', '#fbbf24', '#a3e635',
  '#34d399', '#22d3ee', '#60a5fa', '#a78bfa',
  '#f472b6', '#94a3b8', '#6b7280', '#1d4ed8',
]

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
  const [editId, setEditId]     = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const createMutation = useMutation({
    mutationFn: () => createCategory(newName.trim(), newColor, createParentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      setNewName('')
      setNewColor(COLOUR_SWATCHES[5])
      setShowCreateForm(false)
      setCreateParentId(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (id: string) => updateCategory(id, editName.trim(), editColor),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setEditId(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })

  const startEdit = (c: Category) => { setEditId(c.id); setEditName(c.name); setEditColor(c.color ?? COLOUR_SWATCHES[5]) }
  const toggleExpand = (id: string) => setExpandedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const allTree = buildCategoryTree(cats)
  const systemRoots = allTree.filter(n => n.system)
  const customRoots = allTree.filter(n => !n.system)

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

          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: node.color ?? '#94a3b8' }} />

          {isEditing ? (
            <>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="flex-1 px-2 py-0.5 text-sm border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                onKeyDown={e => { if (e.key === 'Enter') updateMutation.mutate(node.id); if (e.key === 'Escape') setEditId(null) }}
                autoFocus
              />
              <ColourPicker value={editColor} onChange={setEditColor} />
              <button type="button" onClick={() => updateMutation.mutate(node.id)} className="text-blue-500 hover:text-blue-600"><Check className="w-4 h-4" /></button>
              <button type="button" onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-4 h-4" /></button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">{node.name}</span>
              {depth > 0 && (
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono mr-1">L{depth + 1}</span>
              )}
              {!node.system && (
                <div className="hidden group-hover:flex items-center gap-1">
                  <button
                    type="button"
                    title="Add child category"
                    onClick={() => { setCreateParentId(node.id); setShowCreateForm(true); setExpandedIds(prev => new Set([...prev, node.id])) }}
                    className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 p-0.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => startEdit(node)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => deleteMutation.mutate(node.id)} className="text-red-400 hover:text-red-600 p-0.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        {hasChildren && isExpanded && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  if (isLoading) return <div className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Custom Categories</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">Shared across your household</p>
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
            {createParentId && (
              <p className="text-xs text-blue-500 dark:text-blue-400 mb-2">
                Adding child to: <strong>{cats.find(c => c.id === createParentId)?.name}</strong>
                <button type="button" onClick={() => setCreateParentId(null)} className="ml-2 text-gray-400 hover:text-gray-600"><X className="w-3 h-3 inline" /></button>
              </p>
            )}
            <div className="flex gap-2 mb-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Category name…"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) createMutation.mutate(); if (e.key === 'Escape') setShowCreateForm(false) }}
                autoFocus
              />
              <div className="w-9 h-9 rounded-lg border-2 border-gray-300 dark:border-gray-500 flex-shrink-0" style={{ backgroundColor: newColor }} />
            </div>
            <ColourPicker value={newColor} onChange={setNewColor} />
            <div className="flex gap-2 mt-2">
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

        {customRoots.length === 0 && !showCreateForm ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
            No custom categories yet. Create one to get started.
          </p>
        ) : (
          <div className="space-y-0.5">
            {customRoots.map(node => renderNode(node, 0))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">System Categories</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
          Built-in categories — cannot be modified, but custom sub-categories can be added beneath them
        </p>
        <div className="space-y-0.5">
          {systemRoots.map(node => renderNode(node, 0))}
        </div>
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

  const createMutation = useMutation({
    mutationFn: () => createCategoryRule(newPattern.trim(), newCatId, newPriority),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['category-rules'] })
      setNewPattern('')
      setNewCatId('')
      setNewPriority(0)
      setShowForm(false)
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
