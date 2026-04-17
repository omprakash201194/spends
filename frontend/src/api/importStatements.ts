import apiClient from './client'

export interface FileSummary {
  fileName: string
  bankName: string
  accountNumberMasked: string | null
  bankAccountId: string | null
  imported: number
  duplicates: number
  errors: number
  categorized: number
  misc: number
  categorizationPct: number
}

export interface ImportResult {
  totalImported: number
  totalDuplicates: number
  totalErrors: number
  files: FileSummary[]
}

export async function importIciciFiles(files: File[]): Promise<ImportResult> {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  const { data } = await apiClient.post<ImportResult>('/import/icici', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export interface BatchEntry {
  id: string
  filename: string
  bankName: string
  accountNumberMasked: string | null
  bankAccountId: string
  importedAt: string   // ISO 8601: "2026-04-16T10:30:00"
  transactionCount: number
  duplicateCount: number
}

export async function getImportHistory(): Promise<BatchEntry[]> {
  const { data } = await apiClient.get<{ batches: BatchEntry[] }>('/import/history')
  return data.batches
}

export async function deleteImportBatch(batchId: string): Promise<void> {
  await apiClient.delete(`/import/batches/${batchId}`)
}

export async function deleteAllTransactions(): Promise<void> {
  await apiClient.delete('/import/all')
}
