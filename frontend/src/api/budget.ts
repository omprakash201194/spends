import apiClient from './client'

export interface CategoryBudget {
  budgetId: string | null
  categoryId: string
  categoryName: string
  categoryColor: string
  limit: number | null
  spent: number
  percentage: number
}

export interface MonthSummary {
  month: string        // "April 2025" — display label
  year: number
  monthNumber: number  // 1-12
  categories: CategoryBudget[]
}

export async function getBudgets(): Promise<MonthSummary> {
  const { data } = await apiClient.get<MonthSummary>('/budgets')
  return data
}

export async function setBudget(
  categoryId: string,
  year: number,
  month: number,
  limit: number
): Promise<CategoryBudget> {
  const { data } = await apiClient.post<CategoryBudget>('/budgets', { categoryId, year, month, limit })
  return data
}

export async function deleteBudget(id: string): Promise<void> {
  await apiClient.delete(`/budgets/${id}`)
}
