import type { Persona } from '../store/personaStore'

export interface PersonaDefinition {
  id: Persona
  emoji: string
  label: string
  tagline: string
  description: string
  features: string[]     // bullet points shown on onboarding card
  hiddenRoutes: string[] // route prefixes not shown in nav for this persona
}

export const PERSONAS: PersonaDefinition[] = [
  {
    id: 'personal',
    emoji: '💰',
    label: 'Personal',
    tagline: 'I track my own expenses',
    description: 'Solo setup — import your bank statements, categorise spending, and stay on budget.',
    features: [
      'Import ICICI / Bank of Baroda statements',
      'Auto-categorise with smart rules',
      'Monthly & annual budgets',
      'Savings goals with progress tracking',
      'AI spending insights',
    ],
    hiddenRoutes: [
      '/household',
      '/views',
      '/settlements',
      '/dashboards',
      '/merchant-aliases',
      '/data-health',
    ],
  },
  {
    id: 'household',
    emoji: '🏠',
    label: 'Household',
    tagline: 'I share finances with family',
    description: 'Everything in Personal, plus shared household views, split cost tracking, and family-wide spending.',
    features: [
      'Everything in Personal',
      'Household overview across all members',
      'Views — track trips and events together',
      'Settlements — split and track shared costs',
      'Invite family members via invite code',
    ],
    hiddenRoutes: [
      '/dashboards',
      '/merchant-aliases',
      '/data-health',
    ],
  },
  {
    id: 'power',
    emoji: '⚡',
    label: 'Power User',
    tagline: 'I want full control',
    description: 'Every feature unlocked — custom dashboards, merchant aliases, data health audits, and deep category management.',
    features: [
      'Everything in Household',
      'Custom chart dashboards',
      'Merchant alias normalisation',
      'Data health & duplicate audit',
      'Full category rule management',
    ],
    hiddenRoutes: [], // nothing hidden
  },
]

export function getPersonaDef(persona: Persona | null): PersonaDefinition {
  return PERSONAS.find(p => p.id === persona) ?? PERSONAS[2]
}

export function isRouteVisible(persona: Persona | null, path: string): boolean {
  if (!persona) return true // before onboarding, show everything
  const def = getPersonaDef(persona)
  return !def.hiddenRoutes.some(hidden => path === hidden || path.startsWith(hidden + '/'))
}
