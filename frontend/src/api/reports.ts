// spends/frontend/src/api/reports.ts
import apiClient from './client'

export interface CategoryRow {
  category: string
  color: string | null
  amount: number
}

export interface MonthRow {
  yearMonth: string    // "2025-04"
  monthLabel: string   // "April 2025"
  totalSpent: number
  totalIncome: number
  net: number
  categories: CategoryRow[]
}

export interface YearSummary {
  year: number
  months: MonthRow[]
  grandTotalSpent: number
  grandTotalIncome: number
}

export async function getAvailableYears(): Promise<number[]> {
  const { data } = await apiClient.get<number[]>('/reports/available-years')
  return data
}

export async function getMonthlySummary(year: number): Promise<YearSummary> {
  const { data } = await apiClient.get<YearSummary>('/reports/monthly-summary', {
    params: { year },
  })
  return data
}
