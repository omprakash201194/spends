import client from './client'

export type Frequency = 'MONTHLY'

export interface RecurringPattern {
  merchantName: string
  categoryName: string | null
  categoryColor: string | null
  frequency: Frequency
  averageAmount: number
  occurrences: number
  lastMonth: string      // "yyyy-MM"
  nextExpected: string   // "yyyy-MM"
  activeThisMonth: boolean
}

export interface RecurringSummary {
  month: string                  // "April 2025"
  patterns: RecurringPattern[]
}

export async function getRecurring(months?: number): Promise<RecurringSummary> {
  const params = months !== undefined ? { months } : {}
  const res = await client.get<RecurringSummary>('/recurring', { params })
  return res.data
}
