import { useState } from 'react'
import { Sparkles, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react'
import { getInsight, type InsightType } from '../api/insights'

interface Props {
  type: InsightType
  label?: string  // override button label
}

export default function InsightCard({ type, label }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [insight, setInsight] = useState<string | null>(null)
  const [month, setMonth]     = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const fetch = async () => {
    setState('loading')
    setError(null)
    try {
      const res = await getInsight(type)
      setInsight(res.insight)
      setMonth(res.month)
      setState('done')
    } catch (e: unknown) {
      const msg = extractError(e)
      setError(msg)
      setState('error')
    }
  }

  const buttonLabel = label ?? 'Get AI Insights'

  return (
    <div className="bg-white rounded-xl border border-purple-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 bg-purple-50 border-b border-purple-100">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-semibold text-purple-900">AI Insights</span>
          {month && state === 'done' && (
            <span className="text-xs text-purple-400">{month}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {state === 'done' && (
            <button
              onClick={fetch}
              className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-700"
              title="Regenerate"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate
            </button>
          )}
          {(state === 'idle' || state === 'error') && (
            <button
              onClick={fetch}
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
        <div className="px-5 py-6 text-center text-sm text-gray-400">
          Click <span className="font-medium text-purple-600">{buttonLabel}</span> to get personalised insights powered by Claude AI.
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

// Render bullet lines with inline **bold** support
function InsightText({ text }: { text: string }) {
  const lines = text.split('\n').filter(l => l.trim())
  return (
    <ul className="space-y-2.5">
      {lines.map((line, i) => {
        const clean = line.replace(/^[•\-*]\s*/, '').trim()
        return (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700 leading-relaxed">
            <span className="text-purple-400 mt-0.5 flex-shrink-0">•</span>
            <span>{renderInline(clean)}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** Parse **bold** markers into <strong> elements. */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
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
