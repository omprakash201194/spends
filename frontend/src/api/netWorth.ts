import apiClient from './client'

export interface MonthPoint {
  year: number
  month: number
  netFlow: number
  cumulativeNet: number
}

export interface NetWorthResponse {
  points: MonthPoint[]
}

export async function getNetWorth(months = 12): Promise<NetWorthResponse> {
  const { data } = await apiClient.get<NetWorthResponse>('/net-worth', { params: { months } })
  return data
}
