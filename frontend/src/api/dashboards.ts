import apiClient from './client'

export interface Dashboard {
  id: string
  name: string
  createdAt: string
}

export async function getDashboards(): Promise<Dashboard[]> {
  const { data } = await apiClient.get<Dashboard[]>('/dashboards')
  return data
}

export async function createDashboard(name: string): Promise<Dashboard> {
  const { data } = await apiClient.post<Dashboard>('/dashboards', { name })
  return data
}

export async function renameDashboard(id: string, name: string): Promise<Dashboard> {
  const { data } = await apiClient.patch<Dashboard>(`/dashboards/${id}`, { name })
  return data
}

export async function deleteDashboard(id: string): Promise<void> {
  await apiClient.delete(`/dashboards/${id}`)
}
