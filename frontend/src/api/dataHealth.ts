import client from './client'

export interface TransactionStats {
  total: number
  uncategorized: number
  miscellaneous: number
  earliestDate: string | null
  latestDate: string | null
  accountCount: number
}

export interface RuleStats {
  userRules: number
  globalRules: number
}

export interface NearDuplicate {
  accountLabel: string
  date: string
  amount: number
  count: number
}

export interface DataHealthReport {
  transactions: TransactionStats
  rules: RuleStats
  nearDuplicates: NearDuplicate[]
}

export async function getDataHealthReport(): Promise<DataHealthReport> {
  const { data } = await client.get<DataHealthReport>('/data-health')
  return data
}
