import apiClient from './client'

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  system: boolean
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await apiClient.get<Category[]>('/categories')
  return data
}
