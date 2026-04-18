function isNoise(tag: string): boolean {
  if (tag.length < 2) return true
  if (/^\d+$/.test(tag)) return true
  if (/^[a-f0-9]{8,}$/.test(tag)) return true
  if (/\d{6,}/.test(tag)) return true
  return false
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
