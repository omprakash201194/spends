import apiClient from './client'

export interface Category {
  id: string
  name: string
  icon: string | null
  color: string | null
  system: boolean
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await apiClient.get<Category[]>('/categories')
  return data
}

export async function createCategory(name: string, color: string): Promise<Category> {
  const { data } = await apiClient.post<Category>('/categories', { name, color })
  return data
}

export async function updateCategory(id: string, name: string, color: string): Promise<Category> {
  const { data } = await apiClient.put<Category>(`/categories/${id}`, { name, color })
  return data
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/categories/${id}`)
}
