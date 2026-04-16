import apiClient from './client'

export interface CategoryStat {
  name: string
  color: string
  amount: number
}

export interface MonthlyTrend {
  month: string      // "Jan"
  yearMonth: string  // "2025-01"
  spent: number
  income: number
}

export interface MerchantStat {
  merchant: string
  amount: number
  count: number
}

export interface Comparison {
  spent: number
  income: number
  transactionCount: number
}

export interface DashboardSummary {
  month: string
  totalSpent: number
  totalIncome: number
  netSavings: number
  transactionCount: number
  categoryBreakdown: CategoryStat[]
  monthlyTrend: MonthlyTrend[]
  topMerchants: MerchantStat[]
  prevMonth: Comparison | null
  prevYear: Comparison | null
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>('/dashboard/summary')
  return data
}
