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

// ── External schema import (keyword-based classifier JSON) ────────────────────
// Auto-converts a `{categories: [{name, keywords, purpose_keywords, exclusion_rules, ...}]}`
// payload into SpendStack's Bundle shape so it can flow through the existing
// preview-then-commit import path. Emojis are preserved as-is in the icon field;
// purpose_keywords expand into separate rules (AND-logic is lost — documented).

interface ExternalCategory {
  name?: string
  description?: string
  color_hex?: string
  icon?: string
  keywords?: string[]
  purpose_keywords?: string[]
  exclusion_rules?: { keywords?: string[] }[]
  is_default?: boolean
}

export interface ExternalConversionStats {
  categoriesConverted: number
  rulesFromKeywords: number
  rulesFromPurposeKeywords: number
  rulesFromExclusions: number
  defaultCategorySkipped: boolean
}

export function isExternalCategorySchema(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object') return false
  const p = parsed as Record<string, unknown>
  if (!Array.isArray(p.categories) || p.categories.length === 0) return false
  const first = p.categories[0] as Record<string, unknown> | null
  if (!first || typeof first !== 'object') return false
  // Distinguishing marker: external schema has `keywords` on categories;
  // SpendStack's own Bundle has `rules` instead.
  return Array.isArray(first.keywords) && !Array.isArray(first.rules)
}

export function convertExternalToBundle(parsed: unknown): { bundle: Bundle; stats: ExternalConversionStats } {
  const ext = parsed as { categories?: ExternalCategory[]; metadata?: { currency?: string } }
  const stats: ExternalConversionStats = {
    categoriesConverted: 0,
    rulesFromKeywords: 0,
    rulesFromPurposeKeywords: 0,
    rulesFromExclusions: 0,
    defaultCategorySkipped: false,
  }
  const cats: BundleCategory[] = []
  for (const c of ext.categories ?? []) {
    if (!c.name?.trim()) continue
    if (c.is_default) { stats.defaultCategorySkipped = true; continue }

    const seen = new Set<string>()
    const rules: BundleRule[] = []
    const addRule = (raw: string, exclusion: boolean, bucket: 'kw' | 'purpose' | 'excl') => {
      const norm = raw.trim().toLowerCase()
      if (!norm) return
      const key = `${norm}|${exclusion ? 1 : 0}`
      if (seen.has(key)) return
      seen.add(key)
      rules.push({ pattern: norm, priority: 0, exclusion })
      if (bucket === 'kw') stats.rulesFromKeywords++
      else if (bucket === 'purpose') stats.rulesFromPurposeKeywords++
      else stats.rulesFromExclusions++
    }
    for (const kw of c.keywords ?? []) addRule(kw, false, 'kw')
    for (const kw of c.purpose_keywords ?? []) addRule(kw, false, 'purpose')
    for (const er of c.exclusion_rules ?? []) {
      for (const kw of er.keywords ?? []) addRule(kw, true, 'excl')
    }

    cats.push({
      name: c.name.trim(),
      color: c.color_hex?.trim() || null,
      icon: c.icon?.trim() || null,
      parentName: null,
      description: c.description?.trim() || null,
      rules,
    })
    stats.categoriesConverted++
  }

  return {
    bundle: {
      schemaVersion: 'spendstack-bundle/1.0',
      metadata: {
        exportedAt: new Date().toISOString(),
        packName: 'Imported pack',
        currency: ext.metadata?.currency ?? 'INR',
      },
      categories: cats,
    },
    stats,
  }
}
