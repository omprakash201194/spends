import apiClient from './client'

export type AlertType = 'LARGE_TRANSACTION' | 'NEW_MERCHANT' | 'CATEGORY_SPIKE'

export interface Alert {
  type: AlertType
  title: string
  message: string
  amount: number
}

export interface AlertSummary {
  month: string
  alerts: Alert[]
}

export async function getAlerts(): Promise<AlertSummary> {
  const { data } = await apiClient.get<AlertSummary>('/alerts')
  return data
}
