import apiClient from './client'

export type WidgetType = 'PIE' | 'BAR' | 'LINE' | 'STAT'
export type FilterType = 'ALL' | 'CATEGORY' | 'TAG'
export type Metric = 'SPEND' | 'INCOME' | 'COUNT'

export interface Widget {
  id: string
  dashboardId: string
  title: string
  widgetType: WidgetType
  filterType: FilterType
  filterValue: string | null
  metric: Metric
  periodMonths: number
  color: string
  position: number
  gridX: number
  gridY: number
  gridW: number
  gridH: number
  accountId: string | null
  customFrom: string | null
  customTo: string | null
}

export interface CreateWidgetRequest {
  title: string
  widgetType: WidgetType
  filterType: FilterType
  filterValue?: string
  metric: Metric
  periodMonths: number
  color: string
  accountId?: string
  customFrom?: string
  customTo?: string
}

export interface UpdateWidgetRequest {
  title: string
  widgetType: WidgetType
  filterType: FilterType
  filterValue?: string
  metric: Metric
  periodMonths: number
  color: string
  accountId?: string
  customFrom?: string
  customTo?: string
}

export interface PreviewRequest {
  widgetType: WidgetType
  filterType: FilterType
  filterValue?: string
  metric: Metric
  periodMonths: number
  color: string
  accountId?: string
  customFrom?: string
  customTo?: string
}

export interface DataSlice {
  /** Set when the slice represents a category. Null for TAG-filter widgets. */
  categoryId: string | null
  label: string
  color: string
  value: number
}

export interface DataPoint {
  month: string
  spend: number
  income: number
  count: number
}

export interface StatData {
  value: number
  label: string
}

export interface WidgetData {
  widgetType: WidgetType
  metric: Metric
  slices: DataSlice[] | null
  points: DataPoint[] | null
  stat: StatData | null
}

export interface LayoutItem {
  id: string
  gridX: number
  gridY: number
  gridW: number
  gridH: number
}

export async function getWidgets(dashboardId: string): Promise<Widget[]> {
  const { data } = await apiClient.get<Widget[]>(`/dashboards/${dashboardId}/widgets`)
  return data
}

export async function createWidget(dashboardId: string, req: CreateWidgetRequest): Promise<Widget> {
  const { data } = await apiClient.post<Widget>(`/dashboards/${dashboardId}/widgets`, req)
  return data
}

export async function updateWidget(id: string, req: UpdateWidgetRequest): Promise<Widget> {
  const { data } = await apiClient.put<Widget>(`/widgets/${id}`, req)
  return data
}

export async function deleteWidget(id: string): Promise<void> {
  await apiClient.delete(`/widgets/${id}`)
}

export async function moveWidget(id: string, position: number): Promise<void> {
  await apiClient.post(`/widgets/${id}/move`, { position })
}

export async function duplicateWidget(id: string): Promise<Widget> {
  const { data } = await apiClient.post<Widget>(`/widgets/${id}/duplicate`)
  return data
}

export async function applyLayout(items: LayoutItem[]): Promise<void> {
  await apiClient.post('/widgets/layout', { items })
}

export async function getWidgetData(id: string): Promise<WidgetData> {
  const { data } = await apiClient.get<WidgetData>(`/widgets/${id}/data`)
  return data
}

export async function previewWidget(req: PreviewRequest): Promise<WidgetData> {
  const { data } = await apiClient.post<WidgetData>('/widgets/preview', req)
  return data
}
