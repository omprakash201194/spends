import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Persona = 'personal' | 'household' | 'power'

interface PersonaState {
  persona: Persona | null
  onboardingDone: boolean
  setPersona: (p: Persona) => void
  completeOnboarding: (p: Persona) => void
  resetOnboarding: () => void
}

export const usePersonaStore = create<PersonaState>()(
  persist(
    (set) => ({
      persona: null,
      onboardingDone: false,
      setPersona: (p) => set({ persona: p }),
      completeOnboarding: (p) => set({ persona: p, onboardingDone: true }),
      resetOnboarding: () => set({ persona: null, onboardingDone: false }),
    }),
    { name: 'spends-persona' }
  )
)
