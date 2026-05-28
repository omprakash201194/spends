import { FeatureGuide } from '../components/FeatureGuide'
import React, { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, X, Trash2, Tag, Sliders, Check, ChevronDown, ChevronRight, Sparkles,
  Briefcase, ShoppingCart, Utensils, Car, Home, Heart, Music, Zap,
  TrendingUp, DollarSign, Gift, Coffee, Plane, Book, Smartphone,
  Baby, Dumbbell, Dog, Wallet, Bus, Fuel, Pizza, Shirt,
  Download, Upload, MoreHorizontal, Package, RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import {
  getCategories, createCategory, updateCategory, deleteCategory,
  exportCategories, importCategories,
  buildCategoryTree, flattenWithDepth,
  type Category, type CategoryNode, type CategoryExportEntry,
} from '../api/categories'
import {
  getCategoryRules, createCategoryRule, updateCategoryRule, deleteCategoryRule,
  reapplyCategoryRules, exportCategoryRules, importCategoryRules,
  type CategoryRule, type RuleExportEntry,
} from '../api/categoryRules'
import {
  exportBundle, importBundle, previewBundleImport, downloadBundleFile,
  isExternalCategorySchema, convertExternalToBundle,
  type Bundle, type BundleImportSummary, type ExternalConversionStats,
} from '../api/categoryBundle'
import CodeMirror from '@uiw/react-codemirror'
import { json as jsonLang } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { useThemeStore } from '../store/themeStore'

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
      <FeatureGuide />
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

// ── Share Pack panel (bundle export/import) ──────────────────────────────────

function SharePackPanel() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [packName, setPackName] = useState('')
  const [exporting, setExporting] = useState(false)
  const [pendingBundle, setPendingBundle] = useState<Bundle | null>(null)
  const [preview, setPreview] = useState<BundleImportSummary | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [importResult, setImportResult] = useState<BundleImportSummary | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [reapplyPrompt, setReapplyPrompt] = useState(false)
  const [reapplyCount, setReapplyCount] = useState<number | null>(null)
  const [jsonOpen, setJsonOpen] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [jsonBusy, setJsonBusy] = useState(false)
  const [conversionStats, setConversionStats] = useState<ExternalConversionStats | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const theme = useThemeStore(s => s.theme)

  const reapplyMut = useMutation({
    mutationFn: reapplyCategoryRules,
    onSuccess: (r) => {
      setReapplyCount(r.updated)
      setReapplyPrompt(false)
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['budgets'] })
      qc.invalidateQueries({ queryKey: ['recurring'] })
      setTimeout(() => setReapplyCount(null), 5000)
    },
  })

  async function handleExport() {
    setExporting(true)
    try {
      const bundle = await exportBundle(packName.trim() || undefined)
      const stamp = new Date().toISOString().slice(0, 10)
      const slug = (packName.trim() || 'spendstack-pack').toLowerCase().replace(/[^a-z0-9]+/g, '-')
      downloadBundleFile(bundle, `${slug}-${stamp}.json`)
    } finally {
      setExporting(false)
    }
  }

  function resetImportState() {
    setImportError(null)
    setImportResult(null)
    setPreview(null)
    setPendingBundle(null)
    setConversionStats(null)
  }

  /**
   * Accept either a SpendStack Bundle or the external keyword-classifier schema.
   * Converts the external shape client-side, then runs the existing server preview.
   */
  async function runPreviewFromAny(parsed: unknown) {
    let bundle: Bundle
    if (isExternalCategorySchema(parsed)) {
      const { bundle: converted, stats } = convertExternalToBundle(parsed)
      bundle = converted
      setConversionStats(stats)
    } else {
      bundle = parsed as Bundle
      setConversionStats(null)
    }
    if (!bundle?.schemaVersion?.startsWith('spendstack-bundle/')) {
      setImportError('Unrecognised format — expected a SpendStack bundle or a classifier schema with "categories[].keywords"')
      return
    }
    setPreviewing(true)
    try {
      const summary = await previewBundleImport(bundle)
      setPendingBundle(bundle)
      setPreview(summary)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Preview failed'
      setImportError(msg)
    } finally {
      setPreviewing(false)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    resetImportState()
    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      setImportError('Invalid file — expected a JSON bundle or classifier schema')
      return
    }
    await runPreviewFromAny(parsed)
  }

  async function loadCurrentIntoEditor() {
    setJsonError(null)
    setJsonBusy(true)
    try {
      const bundle = await exportBundle(packName.trim() || undefined)
      setJsonText(JSON.stringify(bundle, null, 2))
    } catch (err: unknown) {
      setJsonError(err instanceof Error ? err.message : 'Failed to load current pack')
    } finally {
      setJsonBusy(false)
    }
  }

  async function validateAndPreviewJson() {
    setJsonError(null)
    resetImportState()
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch (err: unknown) {
      setJsonError(`JSON parse error: ${err instanceof Error ? err.message : 'invalid JSON'}`)
      return
    }
    await runPreviewFromAny(parsed)
  }

  async function confirmImport() {
    if (!pendingBundle) return
    setImporting(true)
    try {
      const result = await importBundle(pendingBundle)
      setImportResult(result)
      setPendingBundle(null)
      setPreview(null)
      setReapplyCount(null)
      // Offer reapply only if anything actually landed in the DB.
      setReapplyPrompt(result.categoriesCreated + result.rulesCreated > 0)
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['category-rules'] })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed'
      setImportError(msg)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="mb-4 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Share a category pack</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">— bundles categories + rules + descriptions in one file</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-indigo-200 dark:border-indigo-800">
          {/* Export */}
          <div className="pt-3">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Export pack</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={packName}
                onChange={e => setPackName(e.target.value)}
                placeholder="Pack name (optional) — e.g. Indian Personal Finance"
                className="flex-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
              >
                <Download className="w-3.5 h-3.5" /> {exporting ? 'Exporting…' : 'Download'}
              </button>
            </div>
          </div>

          {/* Import */}
          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Import pack</p>
            {!preview && !importResult && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={previewing}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-xs font-medium rounded-lg disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" /> {previewing ? 'Reading…' : 'Choose pack file…'}
              </button>
            )}
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />

            {conversionStats && (
              <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                  Detected external classifier schema — converted to a SpendStack pack
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  {conversionStats.categoriesConverted} categor{conversionStats.categoriesConverted === 1 ? 'y' : 'ies'},{' '}
                  {conversionStats.rulesFromKeywords} base pattern{conversionStats.rulesFromKeywords === 1 ? '' : 's'}
                  {conversionStats.rulesFromPurposeKeywords > 0 && `, ${conversionStats.rulesFromPurposeKeywords} from purpose_keywords (AND-logic flattened to OR)`}
                  {conversionStats.rulesFromExclusions > 0 && `, ${conversionStats.rulesFromExclusions} exclusion rule${conversionStats.rulesFromExclusions === 1 ? '' : 's'}`}
                  {conversionStats.defaultCategorySkipped && ' · default "Other" category skipped'}
                </p>
              </div>
            )}

            {preview && pendingBundle && (
              <div className="mt-2 p-3 bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-700 rounded-lg">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-100 mb-1">
                  Preview {pendingBundle.metadata?.packName ? `“${pendingBundle.metadata.packName}”` : ''}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Will create <strong>{preview.categoriesCreated}</strong> categor{preview.categoriesCreated === 1 ? 'y' : 'ies'} and <strong>{preview.rulesCreated}</strong> rule{preview.rulesCreated === 1 ? '' : 's'}.
                  {' '}Skip <strong>{preview.categoriesSkipped}</strong> existing categor{preview.categoriesSkipped === 1 ? 'y' : 'ies'} and <strong>{preview.rulesSkipped}</strong> duplicate rule{preview.rulesSkipped === 1 ? '' : 's'}.
                </p>
                {preview.errors.length > 0 && (
                  <ul className="mt-1 text-[11px] text-amber-700 dark:text-amber-400 list-disc list-inside">
                    {preview.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                    {preview.errors.length > 5 && <li>…and {preview.errors.length - 5} more</li>}
                  </ul>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={confirmImport}
                    disabled={importing}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium rounded"
                  >
                    {importing ? 'Importing…' : 'Confirm import'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPreview(null); setPendingBundle(null) }}
                    className="px-3 py-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {importResult && (
              <div className="mt-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg flex items-start justify-between gap-3">
                <p className="text-xs text-green-800 dark:text-green-200">
                  Imported <strong>{importResult.categoriesCreated}</strong> categor{importResult.categoriesCreated === 1 ? 'y' : 'ies'} and <strong>{importResult.rulesCreated}</strong> rule{importResult.rulesCreated === 1 ? '' : 's'}.
                  {(importResult.categoriesSkipped > 0 || importResult.rulesSkipped > 0) &&
                    ` Skipped ${importResult.categoriesSkipped} categor${importResult.categoriesSkipped === 1 ? 'y' : 'ies'} and ${importResult.rulesSkipped} duplicate rule${importResult.rulesSkipped === 1 ? '' : 's'}.`}
                </p>
                <button onClick={() => { setImportResult(null); setReapplyPrompt(false); setReapplyCount(null) }} className="opacity-60 hover:opacity-100">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {reapplyPrompt && (
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between gap-3">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  Apply the new rules and exclusions to your existing transactions?
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => reapplyMut.mutate()}
                    disabled={reapplyMut.isPending}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded"
                  >
                    {reapplyMut.isPending ? 'Applying…' : 'Yes, apply'}
                  </button>
                  <button
                    onClick={() => setReapplyPrompt(false)}
                    className="px-3 py-1 text-xs text-blue-700 dark:text-blue-300 hover:underline"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}

            {reapplyCount !== null && (
              <div className="mt-2 p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-start justify-between gap-3">
                <p className="text-xs text-emerald-800 dark:text-emerald-200">
                  {reapplyCount === 0
                    ? 'No transactions changed — they were already categorized correctly.'
                    : `${reapplyCount} transaction${reapplyCount === 1 ? '' : 's'} updated.`}
                </p>
                <button onClick={() => setReapplyCount(null)} className="opacity-60 hover:opacity-100">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {importError && (
              <div className="mt-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg flex items-start justify-between gap-3">
                <p className="text-xs text-red-700 dark:text-red-300">{importError}</p>
                <button onClick={() => setImportError(null)} className="opacity-60 hover:opacity-100">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Raw JSON editor (power user) */}
          <div className="border-t border-indigo-200 dark:border-indigo-800 pt-3">
            <button
              type="button"
              onClick={() => setJsonOpen(v => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200"
            >
              {jsonOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Edit raw JSON
              <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400">— bulk edits, paste a shared pack, or hand-author</span>
            </button>

            {jsonOpen && (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={loadCurrentIntoEditor}
                    disabled={jsonBusy}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-xs font-medium rounded-lg disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" /> {jsonBusy ? 'Loading…' : 'Load current pack'}
                  </button>
                  <button
                    type="button"
                    onClick={validateAndPreviewJson}
                    disabled={!jsonText.trim() || previewing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
                  >
                    <Check className="w-3.5 h-3.5" /> {previewing ? 'Validating…' : 'Validate & preview'}
                  </button>
                  {jsonText.trim() && (
                    <button
                      type="button"
                      onClick={() => { setJsonText(''); setJsonError(null) }}
                      className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                  <CodeMirror
                    value={jsonText}
                    height="320px"
                    theme={theme === 'dark' ? oneDark : 'light'}
                    extensions={[jsonLang()]}
                    onChange={v => setJsonText(v)}
                    placeholder='Paste a SpendStack bundle or an external classifier schema ({categories: [{name, keywords, ...}]}), or click "Load current pack".'
                    basicSetup={{
                      lineNumbers: true,
                      foldGutter: true,
                      bracketMatching: true,
                      autocompletion: false,
                      highlightActiveLine: true,
                    }}
                  />
                </div>

                {jsonError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg flex items-start justify-between gap-3">
                    <p className="text-xs font-mono text-red-700 dark:text-red-300 whitespace-pre-wrap">{jsonError}</p>
                    <button onClick={() => setJsonError(null)} className="opacity-60 hover:opacity-100 shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
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
  const [newDescription, setNewDescription] = useState('')
  const [editId, setEditId]           = useState<string | null>(null)
  const [editName, setEditName]       = useState('')
  const [editColor, setEditColor]     = useState('')
  const [editIcon, setEditIcon]       = useState<string | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [editParentId, setEditParentId] = useState<string>('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const createMutation = useMutation({
    mutationFn: () => createCategory(newName.trim(), newColor, createParentId, newIcon, newDescription.trim() || null),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      setNewName('')
      setNewColor(COLOUR_SWATCHES[5])
      setNewIcon(null)
      setNewDescription('')
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
      editDescription.trim() || null,
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

  // ── Export / Import ──────────────────────────────────────────────────────
  const importRef = useRef<HTMLInputElement>(null)
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)
  const [importing, setImporting] = useState(false)

  async function handleExport() {
    const data = await exportCategories()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'categories.json'; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = ''
    try {
      const text = await file.text()
      const entries: CategoryExportEntry[] = JSON.parse(text)
      setImporting(true)
      const result = await importCategories(entries)
      qc.invalidateQueries({ queryKey: ['categories'] })
      setImportResult(result)
    } catch {
      setImportResult({ created: 0, skipped: 0, errors: ['Invalid file — make sure it is a categories.json exported from SpendStack'] })
    } finally {
      setImporting(false)
    }
  }

  const startEdit = (c: Category) => {
    setEditId(c.id)
    setEditName(c.name)
    setEditColor(c.color ?? COLOUR_SWATCHES[5])
    setEditIcon(c.icon ?? null)
    setEditDescription(c.description ?? '')
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
              <textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                placeholder="Description (optional) — what this category covers"
                rows={2}
                maxLength={500}
                className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
              />
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
    <>
      <SharePackPanel />
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">All Categories</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {customCount > 0 ? `${customCount} custom · ` : ''}System categories cannot be modified — hover any row to add a subcategory
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-medium rounded-lg transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button type="button" onClick={() => importRef.current?.click()} disabled={importing}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-50">
            <Upload className="w-3.5 h-3.5" /> {importing ? 'Importing…' : 'Import'}
          </button>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
          {!showCreateForm && (
            <button type="button" onClick={() => { setCreateParentId(null); setShowCreateForm(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" /> New Category
            </button>
          )}
        </div>
      </div>

      {importResult && (
        <div className={`mb-4 p-3 rounded-lg border text-xs flex items-start justify-between gap-3 ${
          importResult.errors.length > 0
            ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
            : 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
        }`}>
          <div>
            <p className="font-medium">{importResult.created} created, {importResult.skipped} skipped</p>
            {importResult.errors.map((e, i) => <p key={i} className="mt-0.5 opacity-80">{e}</p>)}
          </div>
          <button onClick={() => setImportResult(null)} className="shrink-0 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Description (optional)</label>
            <textarea
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              placeholder="What this category covers — shown in shared packs"
              rows={2}
              maxLength={500}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>
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
    </>
  )
}

// ── Tab: Rules ────────────────────────────────────────────────────────────────

// ── Grouped JSON shape for editor + downloaded file ─────────────────────────
// Backend export/import endpoints use the flat shape; we convert at the edges.

interface GroupedRuleEntry {
  categoryName: string
  priority: number
  exclusion?: boolean
  patterns: string[]
}

function groupRuleEntries(entries: RuleExportEntry[]): GroupedRuleEntry[] {
  const map = new Map<string, GroupedRuleEntry>()
  for (const e of entries) {
    const excl = e.exclusion ?? false
    const key = `${e.categoryName}|${e.priority}|${excl ? '1' : '0'}`
    let g = map.get(key)
    if (!g) {
      g = { categoryName: e.categoryName, priority: e.priority, exclusion: excl, patterns: [] }
      map.set(key, g)
    }
    g.patterns.push(e.pattern)
  }
  for (const g of map.values()) g.patterns.sort((a, b) => a.localeCompare(b))
  return Array.from(map.values()).sort((a, b) => {
    const c = a.categoryName.localeCompare(b.categoryName)
    if (c !== 0) return c
    if (a.exclusion !== b.exclusion) return a.exclusion ? 1 : -1
    return b.priority - a.priority
  })
}

function flattenGroupedEntries(grouped: GroupedRuleEntry[]): RuleExportEntry[] {
  const out: RuleExportEntry[] = []
  for (const g of grouped) {
    for (const p of g.patterns) {
      out.push({
        pattern: p,
        categoryName: g.categoryName,
        priority: g.priority,
        exclusion: g.exclusion ?? false,
      })
    }
  }
  return out
}

/** Auto-detect grouped vs flat. Returns null if invalid. Does NOT report errors. */
function parseRulesPayload(parsed: unknown): RuleExportEntry[] | null {
  if (!Array.isArray(parsed)) return null
  if (parsed.length === 0) return []
  const first = parsed[0] as Record<string, unknown> | null
  if (!first || typeof first !== 'object') return null
  if (Array.isArray((first as Record<string, unknown>).patterns)) {
    const ok = validateGrouped(parsed, () => {})
    return ok
  }
  return validateFlat(parsed, () => {})
}

function validateFlat(parsed: unknown[], onError: (msg: string) => void): RuleExportEntry[] | null {
  const out: RuleExportEntry[] = []
  for (let i = 0; i < parsed.length; i++) {
    const e = parsed[i] as Record<string, unknown>
    if (!e || typeof e !== 'object') { onError(`Entry #${i + 1}: must be an object`); return null }
    if (typeof e.pattern !== 'string' || !e.pattern.trim()) {
      onError(`Entry #${i + 1}: "pattern" must be a non-empty string`); return null
    }
    if (typeof e.categoryName !== 'string' || !e.categoryName.trim()) {
      onError(`Entry #${i + 1}: "categoryName" must be a non-empty string`); return null
    }
    if (e.priority !== undefined && typeof e.priority !== 'number') {
      onError(`Entry #${i + 1}: "priority" must be a number`); return null
    }
    if (e.exclusion !== undefined && typeof e.exclusion !== 'boolean') {
      onError(`Entry #${i + 1}: "exclusion" must be a boolean`); return null
    }
    out.push({
      pattern: e.pattern,
      categoryName: e.categoryName,
      priority: typeof e.priority === 'number' ? e.priority : 0,
      exclusion: typeof e.exclusion === 'boolean' ? e.exclusion : false,
    })
  }
  return out
}

function validateGrouped(parsed: unknown[], onError: (msg: string) => void): RuleExportEntry[] | null {
  const groups: GroupedRuleEntry[] = []
  for (let i = 0; i < parsed.length; i++) {
    const g = parsed[i] as Record<string, unknown>
    if (!g || typeof g !== 'object') { onError(`Entry #${i + 1}: must be an object`); return null }
    if (typeof g.categoryName !== 'string' || !g.categoryName.trim()) {
      onError(`Entry #${i + 1}: "categoryName" must be a non-empty string`); return null
    }
    if (g.priority !== undefined && typeof g.priority !== 'number') {
      onError(`Entry #${i + 1}: "priority" must be a number`); return null
    }
    if (g.exclusion !== undefined && typeof g.exclusion !== 'boolean') {
      onError(`Entry #${i + 1}: "exclusion" must be a boolean`); return null
    }
    if (!Array.isArray(g.patterns)) {
      onError(`Entry #${i + 1}: "patterns" must be an array of strings`); return null
    }
    const patterns: string[] = []
    for (let j = 0; j < g.patterns.length; j++) {
      const p = g.patterns[j]
      if (typeof p !== 'string' || !p.trim()) {
        onError(`Entry #${i + 1}, pattern #${j + 1}: must be a non-empty string`); return null
      }
      patterns.push(p)
    }
    groups.push({
      categoryName: g.categoryName,
      priority: typeof g.priority === 'number' ? g.priority : 0,
      exclusion: typeof g.exclusion === 'boolean' ? g.exclusion : false,
      patterns,
    })
  }
  return flattenGroupedEntries(groups)
}

/** A group of rule rows that share a category, priority, and exclusion flag — rendered as one card with chips. */
interface RuleGroup {
  key: string                 // `${categoryId}:${priority}:${exclusion}`
  categoryId: string
  categoryName: string
  categoryColor: string | null
  priority: number
  exclusion: boolean
  patterns: { id: string; pattern: string; aiGenerated: boolean }[]
}

function groupRules(rules: CategoryRule[]): RuleGroup[] {
  const map = new Map<string, RuleGroup>()
  for (const r of rules) {
    const key = `${r.categoryId}:${r.priority}:${r.exclusion ? 'x' : 'i'}`
    let g = map.get(key)
    if (!g) {
      g = {
        key,
        categoryId: r.categoryId,
        categoryName: r.categoryName,
        categoryColor: r.categoryColor,
        priority: r.priority,
        exclusion: r.exclusion,
        patterns: [],
      }
      map.set(key, g)
    }
    g.patterns.push({ id: r.id, pattern: r.pattern, aiGenerated: r.aiGenerated })
  }
  for (const g of map.values()) {
    g.patterns.sort((a, b) => a.pattern.localeCompare(b.pattern))
  }
  return Array.from(map.values()).sort((a, b) => {
    const c = a.categoryName.localeCompare(b.categoryName)
    if (c !== 0) return c
    if (a.exclusion !== b.exclusion) return a.exclusion ? 1 : -1
    return b.priority - a.priority
  })
}

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

  const [showCreate, setShowCreate] = useState(false)

  // Reapply prompt is shared by every mutation that creates/edits a rule
  const [showReapplyPrompt, setShowReapplyPrompt] = useState(false)
  const [reapplyResult, setReapplyResult] = useState<number | null>(null)

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

  // Search filter — handy once you have ~20+ groups
  const [search, setSearch] = useState('')
  const groups = groupRules(rules)
  const filteredGroups = search.trim()
    ? groups.filter(g => {
        const q = search.toLowerCase()
        return g.categoryName.toLowerCase().includes(q)
            || g.patterns.some(p => p.pattern.toLowerCase().includes(q))
      })
    : groups

  // ── Export / Import ──────────────────────────────────────────────────────
  const rulesImportRef = useRef<HTMLInputElement>(null)
  const [rulesImportResult, setRulesImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)
  const [rulesImporting, setRulesImporting] = useState(false)
  const [showIO, setShowIO] = useState(false)
  const ioMenuRef = useRef<HTMLDivElement>(null)
  // Close the import/export menu on outside click
  React.useEffect(() => {
    if (!showIO) return
    const onDown = (e: MouseEvent) => {
      if (ioMenuRef.current && !ioMenuRef.current.contains(e.target as Node)) setShowIO(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showIO])

  // ── Raw JSON editor (power user) ─────────────────────────────────────────
  const [jsonOpen, setJsonOpen] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [jsonBusy, setJsonBusy] = useState(false)
  const theme = useThemeStore(s => s.theme)

  async function handleRulesExport() {
    const data = await exportCategoryRules()
    const grouped = groupRuleEntries(data)
    const blob = new Blob([JSON.stringify(grouped, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'category-rules.json'; a.click()
    URL.revokeObjectURL(url)
    setShowIO(false)
  }

  async function handleRulesImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = ''
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const entries = parseRulesPayload(parsed)
      if (!entries) {
        setRulesImportResult({ created: 0, skipped: 0, errors: ['Invalid file — make sure it is a category-rules.json exported from SpendStack'] })
        return
      }
      setRulesImporting(true)
      const result = await importCategoryRules(entries)
      qc.invalidateQueries({ queryKey: ['category-rules'] })
      setRulesImportResult(result)
      if (result.created > 0) setShowReapplyPrompt(true)
    } catch {
      setRulesImportResult({ created: 0, skipped: 0, errors: ['Invalid file — make sure it is a category-rules.json exported from SpendStack'] })
    } finally {
      setRulesImporting(false)
    }
  }

  async function loadCurrentRulesIntoEditor() {
    setJsonError(null)
    setJsonBusy(true)
    try {
      const data = await exportCategoryRules()
      const grouped = groupRuleEntries(data)
      setJsonText(JSON.stringify(grouped, null, 2))
    } catch (err: unknown) {
      setJsonError(err instanceof Error ? err.message : 'Failed to load current rules')
    } finally {
      setJsonBusy(false)
    }
  }

  function parseAndValidateRulesJson(): RuleExportEntry[] | null {
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch (err: unknown) {
      setJsonError(`JSON parse error: ${err instanceof Error ? err.message : 'invalid JSON'}`)
      return null
    }
    if (!Array.isArray(parsed)) {
      setJsonError('Expected a JSON array of rule entries')
      return null
    }
    if (parsed.length === 0) return []

    // Auto-detect: grouped shape has a "patterns" array; flat shape has a "pattern" string.
    const first = parsed[0] as Record<string, unknown> | null
    const isGrouped = !!first && typeof first === 'object' && Array.isArray((first as Record<string, unknown>).patterns)

    if (isGrouped) return validateGrouped(parsed, setJsonError)
    return validateFlat(parsed, setJsonError)
  }

  function handleValidateJson() {
    setJsonError(null)
    const entries = parseAndValidateRulesJson()
    if (entries) {
      setJsonError(`OK — ${entries.length} rule${entries.length === 1 ? '' : 's'} parsed. Click Import to apply (duplicates by pattern are skipped).`)
    }
  }

  async function handleImportFromJson() {
    setJsonError(null)
    const entries = parseAndValidateRulesJson()
    if (!entries) return
    setRulesImporting(true)
    try {
      const result = await importCategoryRules(entries)
      qc.invalidateQueries({ queryKey: ['category-rules'] })
      setRulesImportResult(result)
      if (result.created > 0) setShowReapplyPrompt(true)
    } catch (err: unknown) {
      setJsonError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setRulesImporting(false)
    }
  }

  if (isLoading) return <div className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">Loading…</div>

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Categorization Rules</h2>

        <div className="flex items-center gap-2">
          {/* Search */}
          {groups.length > 5 && (
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          )}

          {/* Import / Export — collapsed into a kebab menu */}
          <div className="relative" ref={ioMenuRef}>
            <button
              type="button"
              onClick={() => setShowIO(v => !v)}
              className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs rounded-lg"
              title="Import / Export"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            {showIO && (
              <div className="absolute right-0 top-full mt-1 z-10 w-44 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
                <button onClick={handleRulesExport} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
                <button
                  onClick={() => { rulesImportRef.current?.click(); setShowIO(false) }}
                  disabled={rulesImporting}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" /> {rulesImporting ? 'Importing…' : 'Import'}
                </button>
                <button
                  onClick={() => { setJsonOpen(true); setShowIO(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 border-t border-gray-200 dark:border-gray-600"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit raw JSON
                </button>
              </div>
            )}
            <input ref={rulesImportRef} type="file" accept=".json" className="hidden" onChange={handleRulesImportFile} />
          </div>

          <button
            onClick={() => reapplyMutation.mutate()}
            disabled={reapplyMutation.isPending}
            title="Re-run all rules against your existing transactions"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {reapplyMutation.isPending ? 'Applying…' : 'Re-apply all'}
          </button>
          <button
            onClick={() => setShowCreate(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Rule
          </button>
        </div>
      </div>

      {jsonOpen && (
        <div className="mb-4 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Edit rules as JSON</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">— bulk edits, reassign categories, hand-author patterns</span>
            </div>
            <button
              type="button"
              onClick={() => { setJsonOpen(false); setJsonText(''); setJsonError(null) }}
              className="opacity-60 hover:opacity-100"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <button
              type="button"
              onClick={loadCurrentRulesIntoEditor}
              disabled={jsonBusy}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-xs font-medium rounded-lg disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> {jsonBusy ? 'Loading…' : 'Load current rules'}
            </button>
            <button
              type="button"
              onClick={handleValidateJson}
              disabled={!jsonText.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-medium rounded-lg disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" /> Validate
            </button>
            <button
              type="button"
              onClick={handleImportFromJson}
              disabled={!jsonText.trim() || rulesImporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
            >
              <Upload className="w-3.5 h-3.5" /> {rulesImporting ? 'Importing…' : 'Import'}
            </button>
            {jsonText.trim() && (
              <button
                type="button"
                onClick={() => { setJsonText(''); setJsonError(null) }}
                className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                Clear
              </button>
            )}
          </div>

          <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
            <CodeMirror
              value={jsonText}
              height="320px"
              theme={theme === 'dark' ? oneDark : 'light'}
              extensions={[jsonLang()]}
              onChange={v => setJsonText(v)}
              placeholder='Click "Load current rules" to start from your existing rules, or paste a JSON array of {"categoryName": "...", "priority": 0, "exclusion": false, "patterns": ["...", "..."]} entries.'
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                bracketMatching: true,
                autocompletion: false,
                highlightActiveLine: true,
              }}
            />
          </div>

          {jsonError && (
            <div className="mt-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg flex items-start justify-between gap-3">
              <p className="text-xs font-mono text-red-700 dark:text-red-300 whitespace-pre-wrap">{jsonError}</p>
              <button onClick={() => setJsonError(null)} className="opacity-60 hover:opacity-100 shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {rulesImportResult && (
        <div className={`mb-4 p-3 rounded-lg border text-xs flex items-start justify-between gap-3 ${
          rulesImportResult.errors.length > 0
            ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
            : 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
        }`}>
          <div>
            <p className="font-medium">{rulesImportResult.created} created, {rulesImportResult.skipped} skipped</p>
            {rulesImportResult.errors.map((e, i) => <p key={i} className="mt-0.5 opacity-80">{e}</p>)}
          </div>
          <button onClick={() => setRulesImportResult(null)} className="shrink-0 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {showReapplyPrompt && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between gap-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Apply your rules to existing transactions?
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

      {reapplyResult !== null && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-800 dark:text-green-200">
          {reapplyResult === 0
            ? 'No transactions changed — they were already categorized correctly.'
            : `${reapplyResult} transaction${reapplyResult === 1 ? '' : 's'} updated.`}
        </div>
      )}

      {showCreate && (
        <NewRuleGroupForm
          cats={cats}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); setShowReapplyPrompt(true) }}
        />
      )}

      {groups.length === 0 && !showCreate ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
          No rules yet. Rules are created automatically when you re-categorize a transaction,
          or you can add one above.
        </p>
      ) : filteredGroups.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
          No rules match "{search}".
        </p>
      ) : (
        <div className="space-y-2">
          {filteredGroups.map(g => (
            <RuleGroupCard
              key={g.key}
              group={g}
              cats={cats}
              onChanged={() => setShowReapplyPrompt(true)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Rule group card + sub-components ──────────────────────────────────────────

function RuleGroupCard({ group, cats, onChanged }: {
  group: RuleGroup
  cats: Category[]
  onChanged: () => void
}) {
  const qc = useQueryClient()
  const [editingMeta, setEditingMeta] = useState(false)
  const [editCatId, setEditCatId] = useState(group.categoryId)
  const [editPriority, setEditPriority] = useState(group.priority)
  const [editExclusion, setEditExclusion] = useState(group.exclusion)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const invalidateRules = () => qc.invalidateQueries({ queryKey: ['category-rules'] })

  const removePatternMut = useMutation({
    mutationFn: (id: string) => deleteCategoryRule(id),
    onSuccess: invalidateRules,
  })

  const addPatternMut = useMutation({
    mutationFn: (pattern: string) => createCategoryRule(pattern, group.categoryId, group.priority, false, group.exclusion),
    onSuccess: () => { invalidateRules(); onChanged() },
  })

  // Edit category/priority/exclusion — applied to every rule row in the group
  const updateMetaMut = useMutation({
    mutationFn: async () => {
      await Promise.all(
        group.patterns.map(p =>
          updateCategoryRule(p.id, { categoryId: editCatId, priority: editPriority, exclusion: editExclusion })
        )
      )
    },
    onSuccess: () => { invalidateRules(); setEditingMeta(false); onChanged() },
  })

  // Delete the entire group — all rule rows
  const deleteGroupMut = useMutation({
    mutationFn: async () => {
      await Promise.all(group.patterns.map(p => deleteCategoryRule(p.id)))
    },
    onSuccess: () => { invalidateRules(); setConfirmDelete(false) },
  })

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-white dark:bg-gray-800 group">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-2">
        {editingMeta ? (
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <select
              value={editCatId}
              onChange={e => setEditCatId(e.target.value)}
              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              priority
              <input
                type="number"
                value={editPriority}
                onChange={e => setEditPriority(Number(e.target.value))}
                className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1" title="Block this category when patterns match">
              <input
                type="checkbox"
                checked={editExclusion}
                onChange={e => setEditExclusion(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-500"
              />
              exclusion
            </label>
            <button
              onClick={() => updateMetaMut.mutate()}
              disabled={updateMetaMut.isPending || !editCatId}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setEditingMeta(false); setEditCatId(group.categoryId); setEditPriority(group.priority); setEditExclusion(group.exclusion) }}
              className="px-2 py-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: group.categoryColor ?? '#94a3b8' }}
            />
            <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{group.categoryName}</span>
            {group.exclusion && (
              <span
                title="Exclusion: matching transactions are NOT classified as this category"
                className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800"
              >
                blocks
              </span>
            )}
            {group.priority !== 0 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                priority {group.priority}
              </span>
            )}
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {group.patterns.length} {group.patterns.length === 1 ? 'pattern' : 'patterns'}
            </span>
          </div>
        )}

        {!editingMeta && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setEditingMeta(true)}
              className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded"
              title="Edit category / priority"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1 text-gray-400 hover:text-red-500 rounded"
              title="Delete entire rule"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Patterns + add */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {group.patterns.map(p => (
          <PatternChip
            key={p.id}
            pattern={p.pattern}
            aiGenerated={p.aiGenerated}
            onRemove={() => removePatternMut.mutate(p.id)}
            disabled={removePatternMut.isPending}
          />
        ))}
        <AddPatternInline
          onAdd={pattern => addPatternMut.mutate(pattern)}
          isPending={addPatternMut.isPending}
        />
      </div>

      {confirmDelete && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between gap-3">
          <p className="text-xs text-red-800 dark:text-red-300">
            Delete all {group.patterns.length} pattern{group.patterns.length === 1 ? '' : 's'} for {group.categoryName}?
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteGroupMut.mutate()}
              disabled={deleteGroupMut.isPending}
              className="px-2.5 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PatternChip({ pattern, aiGenerated, onRemove, disabled }: {
  pattern: string
  aiGenerated: boolean
  onRemove: () => void
  disabled: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-md text-xs font-mono text-gray-700 dark:text-gray-200">
      {pattern}
      {aiGenerated && (
        <span title="AI-generated">
          <Sparkles className="w-3 h-3 text-violet-500" />
        </span>
      )}
      <button
        onClick={onRemove}
        disabled={disabled}
        className="ml-0.5 p-0.5 text-gray-400 hover:text-red-500 rounded disabled:opacity-50"
        title="Remove pattern"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}

function AddPatternInline({ onAdd, isPending }: { onAdd: (pattern: string) => void; isPending: boolean }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  const submit = () => {
    const v = value.trim()
    if (!v) { setEditing(false); return }
    onAdd(v)
    setValue('')
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        disabled={isPending}
        className="inline-flex items-center gap-1 px-2 py-0.5 border border-dashed border-gray-300 dark:border-gray-600 rounded-md text-xs text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
      >
        <Plus className="w-3 h-3" /> Add pattern
      </button>
    )
  }
  return (
    <input
      autoFocus
      type="text"
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={submit}
      onKeyDown={e => {
        if (e.key === 'Enter')   submit()
        if (e.key === 'Escape') { setValue(''); setEditing(false) }
      }}
      placeholder="keyword…"
      className="px-2 py-0.5 border border-blue-400 rounded-md text-xs font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none w-32"
    />
  )
}

function NewRuleGroupForm({ cats, onClose, onCreated }: {
  cats: Category[]
  onClose: () => void
  onCreated: () => void
}) {
  const qc = useQueryClient()
  const [catId, setCatId] = useState('')
  const [priority, setPriority] = useState(0)
  const [exclusion, setExclusion] = useState(false)
  const [patterns, setPatterns] = useState<string[]>([])
  const [draft, setDraft] = useState('')

  const addPattern = () => {
    const v = draft.trim()
    if (!v) return
    if (patterns.includes(v)) { setDraft(''); return }
    setPatterns(p => [...p, v])
    setDraft('')
  }

  const createMut = useMutation({
    mutationFn: async () => {
      await Promise.all(patterns.map(p => createCategoryRule(p, catId, priority, false, exclusion)))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['category-rules'] })
      setPatterns([])
      setCatId('')
      setPriority(0)
      setExclusion(false)
      onCreated()
    },
  })

  const canSubmit = !!catId && patterns.length > 0 && !createMut.isPending

  return (
    <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">New rule</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div>
        <label className="block text-[10px] uppercase font-medium text-gray-500 dark:text-gray-400 mb-1">Category</label>
        <select
          value={catId}
          onChange={e => setCatId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="">— Select category —</option>
          {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-[10px] uppercase font-medium text-gray-500 dark:text-gray-400 mb-1">Patterns (any of these matches)</label>
        <div className="flex flex-wrap gap-1.5 items-center p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
          {patterns.map(p => (
            <span key={p} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-blue-100 dark:bg-blue-950 rounded-md text-xs font-mono text-blue-800 dark:text-blue-200">
              {p}
              <button
                onClick={() => setPatterns(prev => prev.filter(x => x !== p))}
                className="ml-0.5 p-0.5 text-blue-400 hover:text-red-500 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addPattern() }
              if (e.key === 'Backspace' && !draft && patterns.length > 0) {
                setPatterns(prev => prev.slice(0, -1))
              }
            }}
            onBlur={addPattern}
            placeholder={patterns.length === 0 ? 'paytm, one97 — Enter or comma to add' : ''}
            className="flex-1 min-w-[140px] px-1 py-0.5 text-xs font-mono bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
          />
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
          Each pattern is a substring matched against transaction remarks. Higher priority wins on conflict.
        </p>
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-gray-500 dark:text-gray-400 select-none">Advanced</summary>
        <label className="block mt-2">
          <span className="text-[10px] uppercase font-medium text-gray-500 dark:text-gray-400">Priority</span>
          <input
            type="number"
            value={priority}
            onChange={e => setPriority(Number(e.target.value))}
            className="block w-24 mt-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </label>
        <label className="flex items-center gap-2 mt-3 cursor-pointer">
          <input
            type="checkbox"
            checked={exclusion}
            onChange={e => setExclusion(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-500"
          />
          <span className="text-xs text-gray-600 dark:text-gray-300">
            Exclusion rule — block this category when patterns match
          </span>
        </label>
      </details>

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:underline"
        >
          Cancel
        </button>
        <button
          onClick={() => createMut.mutate()}
          disabled={!canSubmit}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
        >
          {createMut.isPending ? 'Creating…' : `Create ${patterns.length || ''} rule${patterns.length === 1 ? '' : 's'}`}
        </button>
      </div>
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

