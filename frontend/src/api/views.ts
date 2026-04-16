import apiClient from './client'

export type ViewType = 'TRIP' | 'EVENT' | 'CUSTOM'

export interface CategoryBudgetItem {
  categoryId: string
  categoryName: string
  categoryColor: string | null
  expectedAmount: number | null
  actualAmount: number
}

export interface ViewResponse {
  id: string
  name: string
  type: ViewType
  startDate: string          // 'YYYY-MM-DD'
  endDate: string            // 'YYYY-MM-DD'
  description: string | null
  color: string | null
  totalBudget: number | null
  totalSpent: number
  transactionCount: number
  categoryBudgets: CategoryBudgetItem[]
}

export interface CreateViewRequest {
  name: string
  type: ViewType
  startDate: string
  endDate: string
  description?: string
  color?: string
  totalBudget?: number
  categoryBudgets: { categoryId: string; expectedAmount: number }[]
}

export interface UpdateViewRequest {
  name: string
  description?: string
  color?: string
  totalBudget?: number
}

export interface ViewTransactionItem {
  id: string
  merchantName: string | null
  rawRemarks: string
  valueDate: string
  withdrawalAmount: number
  depositAmount: number
  categoryName: string | null
  categoryColor: string | null
  memberName: string
}

export interface ViewTransactionPage {
  content: ViewTransactionItem[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface MemberBreakdown {
  userId: string
  displayName: string
  amount: number
  count: number
}

export interface ViewSummary {
  viewId: string
  name: string
  totalBudget: number | null
  totalSpent: number
  transactionCount: number
  categories: CategoryBudgetItem[]
  members: MemberBreakdown[]
}

// ── Template helpers (UI-only, no API call) ───────────────────────────────────

export type TemplateLine = { categoryName: string; suggested: number }

export const TRIP_TEMPLATE: TemplateLine[] = [
  { categoryName: 'Transport',     suggested: 15000 },
  { categoryName: 'Food & Dining', suggested: 10000 },
  { categoryName: 'Entertainment', suggested: 5000  },
  { categoryName: 'Shopping',      suggested: 5000  },
]

export const EVENT_TEMPLATE: TemplateLine[] = [
  { categoryName: 'Shopping',      suggested: 20000 },
  { categoryName: 'Food & Dining', suggested: 15000 },
  { categoryName: 'Entertainment', suggested: 10000 },
  { categoryName: 'Miscellaneous', suggested: 5000  },
]

// ── API functions ─────────────────────────────────────────────────────────────

export async function listViews(): Promise<ViewResponse[]> {
  const { data } = await apiClient.get<ViewResponse[]>('/views')
  return data
}

export async function createView(req: CreateViewRequest): Promise<ViewResponse> {
  const { data } = await apiClient.post<ViewResponse>('/views', req)
  return data
}

export async function getView(id: string): Promise<ViewResponse> {
  const { data } = await apiClient.get<ViewResponse>(`/views/${id}`)
  return data
}

export async function updateView(id: string, req: UpdateViewRequest): Promise<ViewResponse> {
  const { data } = await apiClient.put<ViewResponse>(`/views/${id}`, req)
  return data
}

export async function deleteView(id: string): Promise<void> {
  await apiClient.delete(`/views/${id}`)
}

export async function getViewTransactions(id: string, page = 0, size = 25): Promise<ViewTransactionPage> {
  const { data } = await apiClient.get<ViewTransactionPage>(`/views/${id}/transactions`, {
    params: { page, size },
  })
  return data
}

export async function getViewSummary(id: string): Promise<ViewSummary> {
  const { data } = await apiClient.get<ViewSummary>(`/views/${id}/summary`)
  return data
}

export async function addTransactionsToView(viewId: string, transactionIds: string[]): Promise<void> {
  await apiClient.post(`/views/${viewId}/transactions`, { transactionIds })
}

export async function removeTransactionFromView(viewId: string, txId: string): Promise<void> {
  await apiClient.delete(`/views/${viewId}/transactions/${txId}`)
}
