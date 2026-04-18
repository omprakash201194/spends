import apiClient from './client'

export interface CategoryRule {
  id: string
  pattern: string
  categoryId: string
  categoryName: string
  categoryColor: string | null
  priority: number
  aiGenerated: boolean
}

export async function getCategoryRules(): Promise<CategoryRule[]> {
  const { data } = await apiClient.get<CategoryRule[]>('/category-rules')
  return data
}

export async function createCategoryRule(
  pattern: string,
  categoryId: string,
  priority: number,
  aiGenerated = false
): Promise<CategoryRule> {
  const { data } = await apiClient.post<CategoryRule>('/category-rules', { pattern, categoryId, priority, aiGenerated })
  return data
}

export async function updateCategoryRule(
  id: string,
  updates: { pattern?: string; categoryId?: string; priority?: number }
): Promise<CategoryRule> {
  const { data } = await apiClient.put<CategoryRule>(`/category-rules/${id}`, updates)
  return data
}

export async function deleteCategoryRule(id: string): Promise<void> {
  await apiClient.delete(`/category-rules/${id}`)
}

export async function reapplyCategoryRules(): Promise<{ updated: number }> {
  const { data } = await apiClient.post<{ updated: number }>('/category-rules/reapply')
  return data
}

export interface RuleExportEntry {
  pattern: string
  categoryName: string
  priority: number
}

export interface RulesImportResult {
  created: number
  skipped: number
  errors: string[]
}

export async function exportCategoryRules(): Promise<RuleExportEntry[]> {
  const { data } = await apiClient.get<RuleExportEntry[]>('/category-rules/export')
  return data
}

export async function importCategoryRules(entries: RuleExportEntry[]): Promise<RulesImportResult> {
  const { data } = await apiClient.post<RulesImportResult>('/category-rules/import', entries)
  return data
}
