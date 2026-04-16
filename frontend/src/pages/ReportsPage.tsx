// spends/frontend/src/pages/ReportsPage.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Download, Printer, Loader2, TrendingDown, TrendingUp } from 'lucide-react'
import { getAvailableYears, getMonthlySummary, type MonthRow } from '../api/reports'
import { clsx } from 'clsx'

// ── Helpers ───────────────────────────────────────────────────────────────────

function inrFull(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Client-side CSV generation ────────────────────────────────────────────────

function generateCsv(months: MonthRow[], year: number): void {
  const rows = ['Month,Total Spent (INR),Total Income (INR),Net (INR),Top Category']
  for (const m of months) {
    const hasData = m.totalSpent > 0 || m.totalIncome > 0
    const topCat = [...m.categories].sort((a, b) => b.amount - a.amount)[0]?.category ?? ''
    rows.push([
      m.monthLabel,
      hasData ? m.totalSpent.toFixed(2) : '',
      hasData ? m.totalIncome.toFixed(2) : '',
      hasData ? m.net.toFixed(2) : '',
      topCat,
    ].join(','))
  }

  const csv = rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `monthly-report-${year}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Month row ─────────────────────────────────────────────────────────────────

function MonthRowComponent({ m }: { m: MonthRow }) {
  const net = m.net
  const hasData = m.totalSpent > 0 || m.totalIncome > 0
  const topCat = [...m.categories].sort((a, b) => b.amount - a.amount)[0]

  return (
    <tr className={clsx('border-b border-gray-100 hover:bg-gray-50', !hasData && 'opacity-40')}>
      <td className="px-4 py-3 font-medium text-gray-800 text-sm">{m.monthLabel}</td>
      <td className="px-4 py-3 text-right text-sm text-gray-900">
        {hasData ? inrFull(m.totalSpent) : '—'}
      </td>
      <td className="px-4 py-3 text-right text-sm text-gray-900">
        {hasData ? inrFull(m.totalIncome) : '—'}
      </td>
      <td className="px-4 py-3 text-right text-sm font-medium">
        {hasData ? (
          <span className={clsx('flex items-center justify-end gap-1', net >= 0 ? 'text-green-600' : 'text-red-600')}>
            {net >= 0
              ? <TrendingUp className="w-3 h-3 flex-shrink-0" />
              : <TrendingDown className="w-3 h-3 flex-shrink-0" />}
            {inrFull(Math.abs(net))}
          </span>
        ) : '—'}
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        {topCat && (
          <span className="flex items-center gap-1.5 text-xs text-gray-600">
            {topCat.color && (
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: topCat.color }} />
            )}
            {topCat.category}
          </span>
        )}
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { data: years = [] } = useQuery({
    queryKey: ['report-years'],
    queryFn: getAvailableYears,
    staleTime: 5 * 60_000,
  })

  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const year = selectedYear ?? (years.length > 0 ? years[0] : new Date().getFullYear())

  const { data: summary, isPending } = useQuery({
    queryKey: ['report-summary', year],
    queryFn: () => getMonthlySummary(year),
    enabled: years.length > 0,
    staleTime: 5 * 60_000,
  })

  const net = summary
    ? summary.grandTotalIncome - summary.grandTotalSpent
    : 0

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">

      {/* Screen header (hidden when printing) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Year selector */}
          {years.length > 0 && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={clsx(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                    year === y ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => summary && generateCsv(summary.months, year)}
            disabled={!summary}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-gray-900">SpendStack — Annual Report {year}</h1>
        <p className="text-sm text-gray-500 mt-1">Monthly income and spending summary</p>
      </div>

      {isPending && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {summary && (
        <>
          {/* Annual stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Annual Spent</p>
              <p className="text-lg font-bold text-gray-900">{inrFull(summary.grandTotalSpent)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Annual Income</p>
              <p className="text-lg font-bold text-gray-900">{inrFull(summary.grandTotalIncome)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Net {net >= 0 ? 'Savings' : 'Deficit'}</p>
              <p className={clsx('text-lg font-bold', net >= 0 ? 'text-green-600' : 'text-red-600')}>
                {inrFull(Math.abs(net))}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Avg Monthly Spend</p>
              <p className="text-lg font-bold text-gray-900">
                {inrFull(summary.grandTotalSpent / 12)}
              </p>
            </div>
          </div>

          {/* Monthly table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Month</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Spent</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Income</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Net</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Top Category</th>
                </tr>
              </thead>
              <tbody>
                {summary.months.map(m => (
                  <MonthRowComponent key={m.yearMonth} m={m} />
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-300">
                  <td className="px-4 py-3 text-sm font-bold text-gray-700">Total {year}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                    {inrFull(summary.grandTotalSpent)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                    {inrFull(summary.grandTotalIncome)}
                  </td>
                  <td className={clsx('px-4 py-3 text-right text-sm font-bold', net >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {inrFull(Math.abs(net))}
                  </td>
                  <td className="hidden sm:table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
