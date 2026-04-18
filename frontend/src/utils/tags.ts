const NOISE_TAGS = new Set([
  'upi', 'ach', 'nach', 'neft', 'rtgs', 'imps', 'ecs',
  'payment', 'payments', 'pay', 'paid', 'transfer', 'txn',
  'fr', 'to', 'from', 'the', 'and', 'for', 'via',
  'bank', 'banks',
  'mr', 'mrs', 'ms', 'dr',
  'ltd', 'pvt', 'inc', 'llp',
  'credit', 'debit', 'ref', 'refno', 'no',
  'a/c', 'ac', 'acct',
  'mob', 'mobile',
  'card', 'cash', 'atm',
  'net', 'online',
  'hdfc', 'icici', 'sbi', 'axis', 'kotak', 'pnb', 'bob',
])

function isNoise(tag: string): boolean {
  if (tag.length < 3) return true
  if (/^\d+$/.test(tag)) return true
  if (/^[a-f0-9]{8,}$/.test(tag)) return true
  if (/\d{6,}/.test(tag)) return true
  return NOISE_TAGS.has(tag)
}

export function extractTags(rawRemarks: string | null | undefined): string[] {
  if (!rawRemarks) return []
  const seen = new Set<string>()
  const tags: string[] = []
  for (const part of rawRemarks.split(/[/\s@_\-|:]+/)) {
    const tag = part.toLowerCase().trim()
    if (tag && !isNoise(tag) && !seen.has(tag)) {
      seen.add(tag)
      tags.push(tag)
    }
  }
  return tags
}
