import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { getAlerts } from '../api/alerts'
import { ALERT_META, AlertRow, inrCompact } from './DashboardPage'

function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return toYearMonth(d)
}

function formatYM(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export default function AlertsPage() {
  const [month, setMonth] = useState(() => toYearMonth(new Date()))
  const isCurrentMonth = month === toYearMonth(new Date())

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', month],
    queryFn: () => getAlerts(month),
    staleTime: 60_000,
  })

  const byType = data
    ? Object.groupBy(data.alerts, a => a.type)
    : null

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 flex items-center justify-center">
          <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Alerts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Unusual spending patterns by month</p>
        </div>
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-between mb-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5">
        <button
          onClick={() => setMonth(m => addMonths(m, -1))}
          className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{formatYM(month)}</span>
        <button
          onClick={() => setMonth(m => addMonths(m, 1))}
          disabled={isCurrentMonth}
          className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      )}

      {data && data.alerts.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 py-14 text-center">
          <Bell className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-400 dark:text-gray-500">No alerts for {formatYM(month)}</p>
        </div>
      )}

      {data && data.alerts.length > 0 && (
        <div className="space-y-4">
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-3">
            {(['LARGE_TRANSACTION', 'NEW_MERCHANT', 'CATEGORY_SPIKE'] as const).map(type => {
              const meta = ALERT_META[type]
              const items = byType?.[type] ?? []
              const total = items.reduce((s, a) => s + a.amount, 0)
              const Icon = meta.icon
              return (
                <div key={type} className={`${meta.bg} rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">{meta.label}</span>
                  </div>
                  <p className="text-base font-bold text-gray-800 dark:text-gray-100">{items.length}</p>
                  {total > 0 && <p className="text-xs text-gray-500 dark:text-gray-400">{inrCompact(total)}</p>}
                </div>
              )
            })}
          </div>

          {/* Alert list grouped by type */}
          {(['LARGE_TRANSACTION', 'NEW_MERCHANT', 'CATEGORY_SPIKE'] as const).map(type => {
            const items = byType?.[type]
            if (!items || items.length === 0) return null
            const meta = ALERT_META[type]
            return (
              <div key={type} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className={`px-4 py-2 ${meta.bg} border-b border-gray-100 dark:border-gray-700`}>
                  <span className={`text-xs font-semibold uppercase tracking-wide ${meta.color}`}>{meta.label}s</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {items.map((alert, i) => <AlertRow key={i} alert={alert} />)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
