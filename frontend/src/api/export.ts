import { useAuthStore } from '../store/authStore'

export interface TransactionExportParams {
  search?: string
  categoryId?: string
  accountId?: string
  type?: string
  dateFrom?: string
  dateTo?: string
  uncategorizedOnly?: boolean
}

/**
 * Fetches GET /api/export/transactions with the JWT header,
 * receives the CSV blob, and triggers a browser file download.
 */
export async function downloadTransactionsCsv(params: TransactionExportParams): Promise<void> {
  const token = useAuthStore.getState().token
  const url = new URL('/api/export/transactions', window.location.origin)

  if (params.search)                          url.searchParams.set('search', params.search)
  if (params.categoryId)                      url.searchParams.set('categoryId', params.categoryId)
  if (params.accountId)                       url.searchParams.set('accountId', params.accountId)
  // 'ALL' means no filter; only send if a specific direction is selected
  if (params.type && params.type !== 'ALL')   url.searchParams.set('type', params.type)
  if (params.dateFrom)                        url.searchParams.set('dateFrom', params.dateFrom)
  if (params.dateTo)                          url.searchParams.set('dateTo', params.dateTo)
  if (params.uncategorizedOnly)               url.searchParams.set('uncategorizedOnly', 'true')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) {
    useAuthStore.getState().logout()
    window.location.href = '/login'
    return
  }
  if (!res.ok) throw new Error('Export failed')

  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objectUrl)
}
