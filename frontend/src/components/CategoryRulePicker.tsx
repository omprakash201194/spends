import { useState, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight, ChevronDown, Check, Loader2 } from 'lucide-react'
import { createCategoryRule, reapplyCategoryRules } from '../api/categoryRules'
import { buildCategoryTree, type Category, type CategoryNode } from '../api/categories'

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

export default function CategoryRulePicker({
  tag, categories, onClose, onApplied,
}: {
  tag: string
  categories: Category[]
  onClose: () => void
  onApplied: () => void
}) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const tree = buildCategoryTree(categories)

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

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
      className="absolute left-0 top-full mt-1 z-50 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col"
      style={{ maxHeight: '300px' }}
    >
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Assign <span className="font-mono text-gray-800 dark:text-gray-200">"{tag}"</span> to:
        </p>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {tree.map(node => (
          <CategoryTreeNode key={node.id} node={node} depth={0} selected={selected} onToggle={toggle} />
        ))}
      </div>
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
    </div>
  )
}
