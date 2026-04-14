import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthResponse } from '../types'

interface AuthState {
  token: string | null
  user: {
    id: string
    username: string
    displayName: string
    role: string
    householdId: string | null
    householdName: string | null
  } | null
  setAuth: (response: AuthResponse) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (response) =>
        set({
          token: response.token,
          user: {
            id: response.userId,
            username: response.username,
            displayName: response.displayName,
            role: response.role,
            householdId: response.householdId,
            householdName: response.householdName,
          },
        }),
      logout: () => set({ token: null, user: null }),
      isAuthenticated: () => !!get().token,
    }),
    { name: 'spends-auth' }
  )
)
