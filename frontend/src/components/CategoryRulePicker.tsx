import { useState, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight, ChevronDown, Check, Loader2, Plus, X } from 'lucide-react'
import { createCategoryRule, reapplyCategoryRules } from '../api/categoryRules'
import { createCategory, buildCategoryTree, flattenWithDepth, type Category, type CategoryNode } from '../api/categories'

const PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b',
]

function CategoryTreeNode({
  node, depth, selected, onToggle,
}: {
  node: CategoryNode; depth: number; selected: Set<string>; onToggle: (id: string) => void
}) {
  const [open, setOpen] = useState(depth === 0)
  const hasChildren = node.children.length > 0
  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
        style={{ paddingLeft: `${8 + depth * 16}px`, paddingRight: '8px' }}
        onClick={() => onToggle(node.id)}
      >
        <input
          type="checkbox"
          checked={selected.has(node.id)}
          onChange={() => onToggle(node.id)}
          onClick={e => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded text-blue-600 flex-shrink-0"
        />
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: node.color ?? '#94a3b8' }} />
        <span className="text-sm text-gray-700 dark:text-gray-200 flex-1 truncate">{node.name}</span>
        {hasChildren && (
          <button onClick={e => { e.stopPropagation(); setOpen(o => !o) }} className="p-0.5 text-gray-400">
            {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        )}
      </div>
      {hasChildren && open && node.children.map(child => (
        <CategoryTreeNode key={child.id} node={child} depth={depth + 1} selected={selected} onToggle={onToggle} />
      ))}
    </div>
  )
}

function NewCategoryForm({
  categories,
  onCreated,
  onCancel,
}: {
  categories: Category[]
  onCreated: (cat: Category) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PALETTE[5])
  const [parentId, setParentId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const flat = flattenWithDepth(buildCategoryTree(categories.filter(c => !c.system)))

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      const cat = await createCategory(trimmed, color, parentId || null)
      onCreated(cat)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-t border-gray-100 dark:border-gray-700 px-3 pt-2 pb-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">New category</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Name */}
      <input
        ref={inputRef}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel() }}
        placeholder="Category name"
        className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Color palette */}
      <div className="flex gap-1.5 flex-wrap">
        {PALETTE.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-5 h-5 rounded-full flex-shrink-0 transition-transform ${color === c ? 'ring-2 ring-offset-1 ring-blue-500 scale-110' : ''}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {/* Parent selector */}
      <select
        value={parentId}
        onChange={e => setParentId(e.target.value)}
        className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">No parent (top-level)</option>
        {flat.map(({ category, depth }) => (
          <option key={category.id} value={category.id}>
            {'\u00a0'.repeat(depth * 2)}{category.name}
          </option>
        ))}
      </select>

      <div className="flex items-center justify-end gap-2 pt-0.5">
        <button onClick={onCancel} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">Cancel</button>
        <button
          onClick={save}
          disabled={!name.trim() || saving}
          className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Create
        </button>
      </div>
    </div>
  )
}

export default function CategoryRulePicker({
  tag, categories, onClose, onApplied, align = 'left',
}: {
  tag: string
  categories: Category[]
  onClose: () => void
  onApplied: () => void
  align?: 'left' | 'right'
}) {
  const qc = useQueryClient()
  const [allCategories, setAllCategories] = useState<Category[]>(categories)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const tree = buildCategoryTree(allCategories)

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const handleCreated = (cat: Category) => {
    const updated = [...allCategories, cat]
    setAllCategories(updated)
    setSelected(prev => new Set([...prev, cat.id]))
    setShowNewForm(false)
    qc.invalidateQueries({ queryKey: ['categories'] })
  }

  const apply = async () => {
    if (selected.size === 0) return
    setApplying(true)
    try {
      for (const catId of Array.from(selected)) {
        await createCategoryRule(tag, catId, 0)
      }
      await reapplyCategoryRules()
      qc.invalidateQueries({ queryKey: ['category-rules'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      setDone(true)
      setTimeout(onApplied, 800)
    } finally {
      setApplying(false)
    }
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1 z-50 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col`}
      style={{ maxHeight: '380px' }}
    >
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Assign <span className="font-mono text-gray-800 dark:text-gray-200">"{tag}"</span> to:
        </p>
      </div>

      <div className="flex-1 overflow-y-auto py-1 min-h-0">
        {tree.map(node => (
          <CategoryTreeNode key={node.id} node={node} depth={0} selected={selected} onToggle={toggle} />
        ))}

        {/* Add new category trigger */}
        {!showNewForm && (
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New category
          </button>
        )}
      </div>

      {showNewForm && (
        <NewCategoryForm
          categories={allCategories}
          onCreated={handleCreated}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {!showNewForm && (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
          <button onClick={onClose} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">
            Cancel
          </button>
          <button
            onClick={apply}
            disabled={selected.size === 0 || applying || done}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {done ? <><Check className="w-3 h-3" /> Done</>
              : applying ? <><Loader2 className="w-3 h-3 animate-spin" /> Applying…</>
              : `Create ${selected.size || ''} rule${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}
