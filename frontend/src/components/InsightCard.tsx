import { useState } from 'react'
import { Sparkles, RefreshCw, AlertCircle, ExternalLink, Clock } from 'lucide-react'
import { getInsight, type InsightType } from '../api/insights'

interface Props {
  type: InsightType
  label?: string  // override button label
}

// ── localStorage helpers ──────────────────────────────────────────────────────

const STORAGE_PREFIX = 'spendstack-insight-'

interface StoredInsight {
  insight: string
  month: string
  generatedAt: string  // ISO 8601
}

function loadStored(type: InsightType): StoredInsight | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + type)
    return raw ? (JSON.parse(raw) as StoredInsight) : null
  } catch {
    return null
  }
}

function saveStored(type: InsightType, data: StoredInsight) {
  try {
    localStorage.setItem(STORAGE_PREFIX + type, JSON.stringify(data))
  } catch { /* storage full or unavailable */ }
}

/** Returns "just now", "5m ago", "3h ago", "yesterday", or "16 Apr" */
function fmtAge(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diffMs / 60_000)
  const hours = Math.floor(diffMs / 3_600_000)
  const days  = Math.floor(diffMs / 86_400_000)
  if (mins  <  1) return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  === 1) return 'yesterday'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InsightCard({ type, label }: Props) {
  // Hydrate from localStorage on mount (lazy initializer — runs once)
  const [initial]    = useState<StoredInsight | null>(() => loadStored(type))
  const [state, setState]       = useState<'idle' | 'loading' | 'done' | 'error'>(initial ? 'done' : 'idle')
  const [insight, setInsight]   = useState<string | null>(initial?.insight ?? null)
  const [month, setMonth]       = useState<string | null>(initial?.month ?? null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(initial?.generatedAt ?? null)
  const [error, setError]       = useState<string | null>(null)

  const generate = async () => {
    setState('loading')
    setError(null)
    try {
      const res = await getInsight(type)
      const now = new Date().toISOString()
      const stored: StoredInsight = { insight: res.insight, month: res.month, generatedAt: now }
      saveStored(type, stored)
      setInsight(res.insight)
      setMonth(res.month)
      setGeneratedAt(now)
      setState('done')
    } catch (e: unknown) {
      setError(extractError(e))
      setState('error')
    }
  }

  const buttonLabel = label ?? 'Get AI Insights'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-purple-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 bg-purple-50 dark:bg-gray-700 border-b border-purple-100 dark:border-gray-600">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-sm font-semibold text-purple-900 dark:text-purple-300">AI Insights</span>
            {state === 'done' && month && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-xs text-purple-400 dark:text-purple-400">{month}</span>
                {generatedAt && (
                  <>
                    <span className="text-xs text-purple-300">·</span>
                    <Clock className="w-3 h-3 text-purple-300 flex-shrink-0" />
                    <span className="text-xs text-purple-300">{fmtAge(generatedAt)}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {state === 'done' && (
            <button
              onClick={generate}
              className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-700 transition-colors"
              title="Regenerate"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate
            </button>
          )}
          {state === 'loading' && (
            <RefreshCw className="w-3.5 h-3.5 text-purple-400 animate-spin" />
          )}
          {(state === 'idle' || state === 'error') && (
            <button
              onClick={generate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {buttonLabel}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {state === 'idle' && (
        <div className="px-5 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
          Click <span className="font-medium text-purple-600">{buttonLabel}</span> to get
          personalised insights powered by Claude AI.
        </div>
      )}

      {state === 'loading' && (
        <div className="px-5 py-6 flex items-center justify-center gap-2 text-sm text-purple-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Analysing your spending…
        </div>
      )}

      {state === 'error' && (
        <div className="px-5 py-4">
          <div className="flex items-start gap-2 text-red-600 text-sm mb-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          {error?.includes('API key') && (
            <a
              href="/settings"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
            >
              Go to Settings <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {state === 'done' && insight && (
        <div className="px-4 sm:px-5 py-4">
          <InsightText text={insight} />
        </div>
      )}
    </div>
  )
}

// ── Text renderer ─────────────────────────────────────────────────────────────

function InsightText({ text }: { text: string }) {
  const lines = text.split('\n').filter(l => l.trim())
  return (
    <ul className="space-y-2.5">
      {lines.map((line, i) => {
        const clean = line.replace(/^[•\-*]\s*/, '').trim()
        return (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
            <span className="text-purple-400 mt-0.5 flex-shrink-0">•</span>
            <span>{renderInline(clean)}</span>
          </li>
        )
      })}
    </ul>
  )
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} className="font-semibold text-gray-900 dark:text-white">{part.slice(2, -2)}</strong>
          : part
      )}
    </>
  )
}

function extractError(e: unknown): string {
  if (e && typeof e === 'object' && 'response' in e) {
    const res = (e as { response?: { data?: { message?: string } } }).response
    return res?.data?.message ?? 'Something went wrong. Please try again.'
  }
  return 'Something went wrong. Please try again.'
}
