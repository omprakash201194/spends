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

export async function getDashboardSummary(accountId?: string): Promise<DashboardSummary> {
  const params = accountId ? { accountId } : {}
  const { data } = await apiClient.get<DashboardSummary>('/dashboard/summary', { params })
  return data
}

// ── Lifetime overview ─────────────────────────────────────────────────────

export interface LifetimeSummary {
  totalTransactions: number
  totalAmount: number
  totalWithdrawals: number
  totalDeposits: number
  dateStart: string | null   // ISO date, null when no transactions
  dateEnd: string | null
}

export interface CategoryAmount {
  name: string
  color: string
  amount: number
}

export interface BankActivity {
  bankName: string
  totalAmount: number
  transactionCount: number
}

export interface MonthlyPoint {
  month: string              // "yyyy-MM"
  withdrawals: number
  deposits: number
}

export interface YearlyPoint {
  year: number
  withdrawals: number
}

export interface DashboardLifetime {
  summary: LifetimeSummary
  categories: CategoryAmount[]
  banks: BankActivity[]
  monthlyTrends: MonthlyPoint[]
  yearly: YearlyPoint[]
}

export async function getDashboardLifetime(): Promise<DashboardLifetime> {
  const { data } = await apiClient.get<DashboardLifetime>('/dashboard/lifetime')
  return data
}
