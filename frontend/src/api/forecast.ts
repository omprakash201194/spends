import apiClient from './client'

export interface PendingCharge {
  merchantName: string
  categoryName: string | null
  categoryColor: string | null
  expectedAmount: number
}

export interface MonthlyForecast {
  month: string             // "June 2025"
  asOf: string              // "18 Jun"
  spentSoFar: number
  projectedAdditional: number
  projectedTotal: number
  daysElapsed: number
  daysInMonth: number
  pendingCharges: PendingCharge[]
  dataUpToDate: boolean
}

export async function getMonthlyForecast(): Promise<MonthlyForecast> {
  const { data } = await apiClient.get<MonthlyForecast>('/forecast/monthly')
  return data
}
