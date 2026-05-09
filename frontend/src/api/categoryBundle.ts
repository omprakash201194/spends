import apiClient from './client'

// ── Bundle schema (mirrors backend BundleDto) ─────────────────────────────────

export interface BundleRule {
  pattern: string
  priority: number
  exclusion: boolean
}

export interface BundleStats {
  transactionCount: number
  totalAmount: number
  sampleTransactions: string[]
}

export interface BundleCategory {
  name: string
  color: string | null
  icon: string | null
  parentName: string | null
  description: string | null
  rules: BundleRule[]
  stats?: BundleStats | null
}

export interface BundleMetadata {
  exportedAt: string
  packName: string | null
  currency: string
}

export interface Bundle {
  schemaVersion: string
  metadata: BundleMetadata
  categories: BundleCategory[]
}

export interface BundleImportSummary {
  dryRun: boolean
  categoriesCreated: number
  categoriesSkipped: number
  rulesCreated: number
  rulesSkipped: number
  errors: string[]
}

// ── API ───────────────────────────────────────────────────────────────────────

export async function exportBundle(packName?: string): Promise<Bundle> {
  const params = packName ? { packName } : undefined
  const { data } = await apiClient.get<Bundle>('/categories/bundle/export', { params })
  return data
}

export async function previewBundleImport(bundle: Bundle): Promise<BundleImportSummary> {
  const { data } = await apiClient.post<BundleImportSummary>('/categories/bundle/preview', bundle)
  return data
}

export async function importBundle(bundle: Bundle): Promise<BundleImportSummary> {
  const { data } = await apiClient.post<BundleImportSummary>('/categories/bundle/import', bundle)
  return data
}

export function downloadBundleFile(bundle: Bundle, filename = 'spendstack-bundle.json'): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
