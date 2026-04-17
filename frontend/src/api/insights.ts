import apiClient from './client'

export type InsightType = 'DASHBOARD' | 'BUDGET' | 'TRANSACTIONS' | 'RECURRING'

export interface InsightResponse {
  insight: string
  month: string
}

export async function getInsight(type: InsightType): Promise<InsightResponse> {
  const { data } = await apiClient.post<InsightResponse>(`/insights/${type}`)
  return data
}

export interface RuleSuggestion {
  pattern: string
  existingCategoryId: string | null
  existingCategoryName: string | null
  suggestNewCategoryName: string | null
  suggestParentCategoryName: string | null
  suggestColor: string | null
}

export interface AutoCategorizeResponse {
  suggestions: RuleSuggestion[]
}

export async function getAutoCategorizeSuggestions(): Promise<AutoCategorizeResponse> {
  const { data } = await apiClient.post<AutoCategorizeResponse>('/insights/auto-categorize')
  return data
}
