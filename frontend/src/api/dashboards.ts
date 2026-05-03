import apiClient from './client'

export interface Dashboard {
  id: string
  name: string
  accountId: string | null
  periodMonths: number | null
  customFrom: string | null
  customTo: string | null
  createdAt: string
}

export interface DashboardFilters {
  accountId?: string | null
  periodMonths?: number | null
  customFrom?: string | null
  customTo?: string | null
}

export async function getDashboards(): Promise<Dashboard[]> {
  const { data } = await apiClient.get<Dashboard[]>('/dashboards')
  return data
}

export async function getDashboard(id: string): Promise<Dashboard> {
  const { data } = await apiClient.get<Dashboard>(`/dashboards/${id}`)
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

export async function updateDashboardFilters(id: string, filters: DashboardFilters): Promise<Dashboard> {
  const { data } = await apiClient.patch<Dashboard>(`/dashboards/${id}/filters`, filters)
  return data
}

export async function duplicateDashboard(id: string): Promise<Dashboard> {
  const { data } = await apiClient.post<Dashboard>(`/dashboards/${id}/duplicate`)
  return data
}

export async function deleteDashboard(id: string): Promise<void> {
  await apiClient.delete(`/dashboards/${id}`)
}
