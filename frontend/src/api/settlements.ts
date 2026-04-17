import apiClient from './client'

export type SettlementStatus = 'OPEN' | 'SETTLED'

export interface SettlementItem {
  id: string
  transactionId?: string
  description: string
  totalAmount: number
  yourShare: number
}

export interface Settlement {
  id: string
  participantName: string
  description?: string
  status: SettlementStatus
  totalOwed: number
  items: SettlementItem[]
  createdAt: string
  settledAt?: string
}

export interface CreateSettlementItem {
  transactionId?: string
  description: string
  totalAmount: number
  yourShare: number
}

export interface CreateSettlementRequest {
  participantName: string
  description?: string
  items: CreateSettlementItem[]
}

export async function getSettlements(): Promise<Settlement[]> {
  const { data } = await apiClient.get<Settlement[]>('/settlements')
  return data
}

export async function createSettlement(req: CreateSettlementRequest): Promise<Settlement> {
  const { data } = await apiClient.post<Settlement>('/settlements', req)
  return data
}

export async function markSettled(id: string): Promise<Settlement> {
  const { data } = await apiClient.patch<Settlement>(`/settlements/${id}/settle`)
  return data
}

export async function deleteSettlement(id: string): Promise<void> {
  await apiClient.delete(`/settlements/${id}`)
}
