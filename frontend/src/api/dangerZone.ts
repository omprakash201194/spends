import apiClient from './client'

export async function deleteAllTransactions(): Promise<void> {
  await apiClient.delete('/danger-zone/transactions')
}

export async function deleteAllRules(): Promise<void> {
  await apiClient.delete('/danger-zone/rules')
}

export async function deleteAllBudgets(): Promise<void> {
  await apiClient.delete('/danger-zone/budgets')
}

export async function deleteAllViews(): Promise<void> {
  await apiClient.delete('/danger-zone/views')
}

export async function deleteAllCustomCategories(): Promise<void> {
  await apiClient.delete('/danger-zone/custom-categories')
}
