import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts'
import type { WidgetData, DataSlice, DataPoint } from '../api/widgets'

const FALLBACK_COLORS = [
  '#6366f1', '#f97316', '#22c55e', '#ef4444',
  '#3b82f6', '#a855f7', '#14b8a6', '#eab308',
]

function fmt(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K`
  return `₹${v.toFixed(0)}`
}

interface Props {
  data: WidgetData
  color: string
  onSliceClick?: (slice: DataSlice) => void
  onPointClick?: (point: DataPoint) => void
  onStatClick?: () => void
}

export default function WidgetRenderer({ data, color, onSliceClick, onPointClick, onStatClick }: Props) {
  if (data.widgetType === 'PIE' && data.slices && data.slices.length > 0) {
    const items = data.slices.map((s, i) => ({
      ...s,
      name: s.label,
      value: Number(s.value),
      fill: s.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    }))
    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={items}
            dataKey="value"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={false}
            onClick={onSliceClick ? (entry) => onSliceClick(entry as DataSlice) : undefined}
            style={onSliceClick ? { cursor: 'pointer' } : undefined}
          >
            {items.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Pie>
          <Tooltip formatter={(v: number) => fmt(v)} />
          <Legend iconType="circle" iconSize={10} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (data.widgetType === 'BAR' && data.slices && data.slices.length > 0) {
    const slices = data.slices
    const items = slices.map((s, i) => ({ name: s.label, value: Number(s.value), __slice: i }))
    const handleBarClick = onSliceClick
      ? (entry: unknown) => {
          const idx = (entry as { __slice?: number; payload?: { __slice?: number } })?.__slice
                   ?? (entry as { payload?: { __slice?: number } })?.payload?.__slice
          if (typeof idx === 'number' && slices[idx]) onSliceClick(slices[idx])
        }
      : undefined
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={items} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={55} />
          <Tooltip formatter={(v: number) => fmt(v)} />
          <Bar
            dataKey="value"
            fill={color}
            radius={[4, 4, 0, 0]}
            onClick={handleBarClick}
            style={onSliceClick ? { cursor: 'pointer' } : undefined}
          />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (data.widgetType === 'LINE' && data.points && data.points.length > 0) {
    const points = data.points
    const metricKey = data.metric === 'INCOME' ? 'income'
                    : data.metric === 'COUNT'  ? 'count'
                    : 'spend'
    const items = points.map(p => ({ month: p.month, value: Number(p[metricKey as keyof typeof p]) }))
    const handleLineChartClick = onPointClick
      ? (state: unknown) => {
          const idx = (state as { activeTooltipIndex?: number })?.activeTooltipIndex
          if (typeof idx === 'number' && points[idx]) onPointClick(points[idx])
        }
      : undefined
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart
          data={items}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          onClick={handleLineChartClick}
          style={onPointClick ? { cursor: 'pointer' } : undefined}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={data.metric === 'COUNT' ? String : fmt} tick={{ fontSize: 11 }} width={55} />
          <Tooltip formatter={(v: number) => data.metric === 'COUNT' ? v : fmt(v)} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={onPointClick ? { r: 3 } : false}
            activeDot={onPointClick ? { r: 5 } : undefined}
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (data.widgetType === 'STAT' && data.stat) {
    const v = Number(data.stat.value)
    return (
      <div
        className={`flex flex-col items-center justify-center h-32 ${onStatClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
        onClick={onStatClick}
      >
        <div className="text-4xl font-bold" style={{ color }}>
          {data.metric === 'COUNT' ? v.toLocaleString() : fmt(v)}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 mt-2 capitalize">{data.stat.label}</div>
      </div>
    )
  }

  return <div className="text-sm text-gray-400 py-8 text-center">No data available</div>
}
