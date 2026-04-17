import apiClient from './client'

export interface SplitItem {
  categoryId?: string
  amount: number
  note?: string
}

export interface SplitResponse {
  id: string
  categoryId?: string
  categoryName?: string
  amount: number
  note?: string
}

export async function getSplits(txId: string): Promise<SplitResponse[]> {
  const { data } = await apiClient.get<SplitResponse[]>(`/transactions/${txId}/splits`)
  return data
}

export async function saveSplits(txId: string, splits: SplitItem[]): Promise<SplitResponse[]> {
  const { data } = await apiClient.put<SplitResponse[]>(`/transactions/${txId}/splits`, { splits })
  return data
}
