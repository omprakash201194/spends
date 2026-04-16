import apiClient from './client'

export interface GoalResponse {
  id: string
  name: string
  target: number
  startDate: string        // "2025-01-01"
  targetDate: string | null
  saved: number
  percentage: number       // 0–100
  achieved: boolean
}

export interface CreateGoalRequest {
  name: string
  target: number
  startDate: string        // "2025-01-01"
  targetDate: string | null
}

export async function getGoals(): Promise<GoalResponse[]> {
  const { data } = await apiClient.get<GoalResponse[]>('/goals')
  return data
}

export async function createGoal(req: CreateGoalRequest): Promise<GoalResponse> {
  const { data } = await apiClient.post<GoalResponse>('/goals', req)
  return data
}

export async function deleteGoal(id: string): Promise<void> {
  await apiClient.delete(`/goals/${id}`)
}
