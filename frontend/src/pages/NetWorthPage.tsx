import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts'
import { getNetWorth } from '../api/netWorth'

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const formatINR = (v: number) =>
  '₹' + Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })

export default function NetWorthPage() {
  const [months, setMonths] = useState(12)
  const { data, isLoading } = useQuery({
    queryKey: ['net-worth', months],
    queryFn: () => getNetWorth(months),
  })

  const chartData = data?.points.map(p => ({
    label: `${MONTH_LABELS[p.month - 1]} ${p.year}`,
    netFlow: p.netFlow,
    cumulativeNet: p.cumulativeNet,
  })) ?? []

  const latest = chartData[chartData.length - 1]

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-gray-50 dark:bg-gray-950 min-h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Net Worth</h1>
        <select
          value={months}
          onChange={e => setMonths(Number(e.target.value))}
          className="text-sm border rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        >
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
          <option value={24}>Last 24 months</option>
        </select>
      </div>

      {latest && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Cumulative Net</p>
            <p className={`text-xl font-bold ${latest.cumulativeNet >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {latest.cumulativeNet >= 0 ? '+' : ''}{formatINR(latest.cumulativeNet)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last Month Net</p>
            <p className={`text-xl font-bold ${latest.netFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {latest.netFlow >= 0 ? '+' : ''}{formatINR(latest.netFlow)}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Cash Flow Over Time</h2>
        {isLoading ? (
          <div className="h-72 flex items-center justify-center text-gray-400">Loading...</div>
        ) : chartData.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-gray-400">No transaction data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={v => '₹' + (Math.abs(v) >= 1000 ? (v/1000).toFixed(0)+'K' : v)} />
              <Tooltip
                formatter={(value: number, name: string) => [formatINR(value), name === 'cumulativeNet' ? 'Cumulative' : 'Monthly Net']}
                labelStyle={{ color: '#374151' }}
              />
              <Legend formatter={v => v === 'cumulativeNet' ? 'Cumulative Net' : 'Monthly Net'} />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="cumulativeNet"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={false}
                name="cumulativeNet"
              />
              <Line
                type="monotone"
                dataKey="netFlow"
                stroke="#10b981"
                strokeWidth={1.5}
                dot={false}
                name="netFlow"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
