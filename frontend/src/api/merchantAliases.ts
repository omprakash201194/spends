import apiClient from './client'

export interface MerchantAlias {
  id: string
  rawPattern: string
  displayName: string
}

export async function getMerchantAliases(): Promise<MerchantAlias[]> {
  const { data } = await apiClient.get<MerchantAlias[]>('/merchant-aliases')
  return data
}

export async function saveMerchantAlias(rawPattern: string, displayName: string): Promise<MerchantAlias> {
  const { data } = await apiClient.post<MerchantAlias>('/merchant-aliases', { rawPattern, displayName })
  return data
}

export async function deleteMerchantAlias(id: string): Promise<void> {
  await apiClient.delete(`/merchant-aliases/${id}`)
}
