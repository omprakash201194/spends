import apiClient from './client'

export interface TagEntry {
  tag: string
  count: number
}

export interface TagsResponse {
  tags: TagEntry[]
}

export async function getTransactionTags(): Promise<TagsResponse> {
  const { data } = await apiClient.get<TagsResponse>('/transactions/tags')
  return data
}
