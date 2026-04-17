import apiClient from './client'

export interface Settings {
  hasApiKey: boolean
  notificationEmail: string | null
}

export async function getSettings(): Promise<Settings> {
  const { data } = await apiClient.get<Settings>('/settings')
  return data
}

export async function saveApiKey(apiKey: string): Promise<Settings> {
  const { data } = await apiClient.put<Settings>('/settings/api-key', { apiKey })
  return data
}

export async function deleteApiKey(): Promise<Settings> {
  const { data } = await apiClient.delete<Settings>('/settings/api-key')
  return data
}

export async function saveNotificationEmail(notificationEmail: string): Promise<Settings> {
  const { data } = await apiClient.put<Settings>('/settings/notification-email', { notificationEmail })
  return data
}

export interface Preferences {
  maxCategoryDepth: number
}

export async function getPreferences(): Promise<Preferences> {
  const { data } = await apiClient.get<Preferences>('/settings/preferences')
  return data
}

export async function savePreferences(maxCategoryDepth: number): Promise<Preferences> {
  const { data } = await apiClient.put<Preferences>('/settings/preferences', { maxCategoryDepth })
  return data
}
