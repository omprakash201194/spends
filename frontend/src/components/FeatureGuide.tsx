import { useState, useEffect } from 'react'
import { HelpCircle, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { getPageGuide } from '../config/featureGuideContent'

const STORAGE_KEY = 'spends-guide-collapsed'

function getCollapsed(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  catch { return {} }
}

function setCollapsed(key: string, value: boolean) {
  const current = getCollapsed()
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, [key]: value }))
}

export function FeatureGuide() {
  const { pathname } = useLocation()
  const guide = getPageGuide(pathname)

  const [open, setOpen] = useState(() => {
    const collapsed = getCollapsed()
    // Default open on first visit to this page, collapsed if user closed it before
    return collapsed[pathname] !== true
  })

  // Re-evaluate open state when navigating to a new page
  useEffect(() => {
    const collapsed = getCollapsed()
    setOpen(collapsed[pathname] !== true)
  }, [pathname])

  const toggle = () => {
    const next = !open
    setOpen(next)
    setCollapsed(pathname, !next) // collapsed[path] = true means user closed it
  }

  if (!guide) return null

  return (
    <div className="mb-4 rounded-xl border border-blue-100 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 overflow-hidden">
      {/* Header bar — always visible */}
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-blue-100/60 dark:hover:bg-blue-900/30 transition-colors"
        aria-expanded={open}
        aria-controls="feature-guide-body"
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            How this page works
          </span>
          <span className="hidden sm:inline text-xs text-blue-500 dark:text-blue-400 font-normal">
            — {guide.summary}
          </span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-blue-400 flex-shrink-0" aria-hidden="true" />
          : <ChevronDown className="w-4 h-4 text-blue-400 flex-shrink-0" aria-hidden="true" />
        }
      </button>

      {/* Expandable body */}
      {open && (
        <div id="feature-guide-body" className="px-4 pb-4 border-t border-blue-100 dark:border-blue-900/60">
          {/* Summary — visible on mobile (hidden inline above on sm+) */}
          <p className="sm:hidden text-xs text-blue-600 dark:text-blue-400 mt-3 mb-3 leading-relaxed">
            {guide.summary}
          </p>

          {/* Feature cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {guide.features.map((f, i) => (
              <div
                key={i}
                className="rounded-lg border border-blue-100 dark:border-blue-900/50 bg-white dark:bg-gray-900/60 p-3 flex flex-col gap-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{f.icon}</span>
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{f.title}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{f.description}</p>
                {f.tip && (
                  <div className="flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50 px-2 py-1.5 mt-0.5">
                    <span className="shrink-0 text-xs mt-px">💡</span>
                    <span className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">{f.tip}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Dismiss hint */}
          <div className="flex items-center justify-end mt-3">
            <button
              onClick={toggle}
              className="flex items-center gap-1 text-xs text-blue-400 dark:text-blue-500 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
              aria-label="Collapse feature guide"
            >
              <X className="w-3 h-3" aria-hidden="true" />
              Collapse
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
