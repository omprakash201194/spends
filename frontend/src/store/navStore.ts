import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface NavState {
  openSections: Record<string, boolean>
  toggle: (key: string) => void
}

export const useNavStore = create<NavState>()(
  persist(
    (set, get) => ({
      openSections: {
        spend:   true,
        plan:    true,
        insights: true,
        manage:  true,
        social:  true,
      },
      toggle: (key) =>
        set({ openSections: { ...get().openSections, [key]: !get().openSections[key] } }),
    }),
    { name: 'spends-nav' },
  ),
)
