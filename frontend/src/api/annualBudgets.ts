import apiClient from './client'

export interface AnnualBudgetResponse {
  id: string
  categoryId: string
  categoryName: string
  categoryIcon: string
  year: number
  amount: number
  spent: number
}

export interface SetAnnualBudgetRequest {
  categoryId: string
  year: number
  amount: number
}

export async function getAnnualBudgets(year: number): Promise<AnnualBudgetResponse[]> {
  const { data } = await apiClient.get<AnnualBudgetResponse[]>('/annual-budgets', { params: { year } })
  return data
}

export async function setAnnualBudget(req: SetAnnualBudgetRequest): Promise<AnnualBudgetResponse> {
  const { data } = await apiClient.put<AnnualBudgetResponse>('/annual-budgets', req)
  return data
}

export async function deleteAnnualBudget(id: string): Promise<void> {
  await apiClient.delete(`/annual-budgets/${id}`)
}
