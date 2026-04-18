import apiClient from './client'

export interface TxCategory {
  id: string
  name: string
  icon: string
  color: string
}

export interface TxAccount {
  id: string
  bankName: string
  accountNumberMasked: string | null
}

export interface Transaction {
  id: string
  account: TxAccount
  valueDate: string
  transactionDate: string
  rawRemarks: string
  merchantName: string | null
  withdrawalAmount: number
  depositAmount: number
  balance: number | null
  category: TxCategory | null
  reviewed: boolean
  note: string | null
  createdAt: string
}

export interface PagedTransactions {
  content: Transaction[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface TransactionFilters {
  search?: string
  searchMode?: 'AND' | 'OR'
  categoryId?: string
  accountId?: string
  type?: 'ALL' | 'DEBIT' | 'CREDIT'
  dateFrom?: string
  dateTo?: string
  page?: number
  size?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

export interface TransactionSummary {
  totalCredit: number
  totalDebit: number
  net: number
  count: number
}

export async function getTransactions(filters: TransactionFilters = {}): Promise<PagedTransactions> {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== '' && v !== 'ALL')
  )
  const { data } = await apiClient.get<PagedTransactions>('/transactions', { params })
  return data
}

export async function getTransactionSummary(filters: Omit<TransactionFilters, 'page' | 'size' | 'sortBy' | 'sortDir'> = {}): Promise<TransactionSummary> {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== '' && v !== 'ALL')
  )
  const { data } = await apiClient.get<TransactionSummary>('/transactions/summary', { params })
  return data
}

export async function updateCategory(
  id: string,
  categoryId: string,
  createRule: boolean,
  pattern?: string
): Promise<Transaction> {
  const { data } = await apiClient.patch<Transaction>(`/transactions/${id}/category`, {
    categoryId,
    createRule,
    pattern: pattern ?? null,
  })
  return data
}

export async function toggleReviewed(id: string): Promise<Transaction> {
  const { data } = await apiClient.patch<Transaction>(`/transactions/${id}/reviewed`)
  return data
}

export async function updateNote(id: string, note: string): Promise<Transaction> {
  const { data } = await apiClient.patch<Transaction>(`/transactions/${id}/note`, { note })
  return data
}

export async function bulkUpdateCategory(ids: string[], categoryId: string): Promise<{ updated: number }> {
  const { data } = await apiClient.patch<{ updated: number }>('/transactions/bulk-category', { ids, categoryId })
  return data
}
