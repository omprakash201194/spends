import apiClient from './client'

export interface FileSummary {
  fileName: string
  bankName: string
  accountNumberMasked: string | null
  bankAccountId: string | null
  imported: number
  duplicates: number
  errors: number
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
