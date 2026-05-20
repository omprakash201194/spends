import apiClient from './client'
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '../types'

export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/login', data)
    return res.data
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/register', data)
    return res.data
  },

  me: async (): Promise<User> => {
    const res = await apiClient.get<User>('/auth/me')
    return res.data
  },

  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post('/auth/forgot-password', { email })
  },

  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    await apiClient.post('/auth/reset-password', { token, newPassword })
  },
}
