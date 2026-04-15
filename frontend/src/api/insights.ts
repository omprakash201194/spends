import apiClient from './client'

export type InsightType = 'DASHBOARD' | 'BUDGET' | 'TRANSACTIONS'

export interface InsightResponse {
  insight: string
  month: string
}

export async function getInsight(type: InsightType): Promise<InsightResponse> {
  const { data } = await apiClient.post<InsightResponse>(`/insights/${type}`)
  return data
}
