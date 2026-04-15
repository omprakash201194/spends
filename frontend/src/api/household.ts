import apiClient from './client'

export interface MemberStat {
  userId: string
  displayName: string
  role: 'ADMIN' | 'MEMBER'
  totalSpent: number
  totalIncome: number
  transactionCount: number
  topCategory: string | null
  topCategoryColor: string | null
}

export interface HouseholdSummary {
  householdId: string
  householdName: string
  inviteCode: string
  month: string
  totalSpent: number
  totalIncome: number
  members: MemberStat[]
}

export async function getHouseholdSummary(): Promise<HouseholdSummary> {
  const { data } = await apiClient.get<HouseholdSummary>('/household')
  return data
}
