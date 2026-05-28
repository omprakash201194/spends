import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { clsx } from 'clsx'
import { PERSONAS, type PersonaDefinition } from '../config/personas'
import { usePersonaStore, type Persona } from '../store/personaStore'

function PersonaCard({
  def,
  selected,
  onClick,
}: {
  def: PersonaDefinition
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'relative w-full text-left rounded-2xl border-2 p-6 transition-all duration-200',
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 shadow-md shadow-blue-100 dark:shadow-blue-950'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm'
      )}
      aria-pressed={selected}
    >
      {/* Selected checkmark */}
      {selected && (
        <span className="absolute top-4 right-4 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
          <Check className="w-3.5 h-3.5 text-white" aria-hidden="true" />
        </span>
      )}

      {/* Emoji */}
      <span className="text-4xl leading-none block mb-3">{def.emoji}</span>

      {/* Label + tagline */}
      <h3 className={clsx(
        'text-lg font-bold mb-0.5',
        selected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'
      )}>
        {def.label}
      </h3>
      <p className={clsx(
        'text-sm mb-4',
        selected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
      )}>
        {def.tagline}
      </p>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
        {def.description}
      </p>

      {/* Feature list */}
      <ul className="space-y-1.5">
        {def.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={clsx(
              'w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5',
              selected ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-600'
            )}>
              <Check className={clsx('w-2.5 h-2.5', selected ? 'text-white' : 'text-gray-400')} aria-hidden="true" />
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{f}</span>
          </li>
        ))}
      </ul>
    </button>
  )
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { completeOnboarding } = usePersonaStore()
  const [selected, setSelected] = useState<Persona | null>(null)

  const handleStart = () => {
    if (!selected) return
    completeOnboarding(selected)
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-start py-12 px-4">
      {/* Logo + header */}
      <div className="flex flex-col items-center gap-4 mb-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-blue-950">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="white" opacity="0.2"/>
            <path d="M12 6v6l4 2" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="12" r="3" fill="white"/>
          </svg>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome to SpendStack
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-base max-w-md">
            Tell us how you use it — we'll show you the features that matter most. You can change this anytime in Settings.
          </p>
        </div>
      </div>

      {/* Persona cards */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {PERSONAS.map(def => (
          <PersonaCard
            key={def.id}
            def={def}
            selected={selected === def.id}
            onClick={() => setSelected(def.id)}
          />
        ))}
      </div>

      {/* Footer CTA */}
      <div className="sticky bottom-0 w-full max-w-4xl">
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur border border-gray-200 dark:border-gray-700 rounded-2xl px-6 py-4 flex items-center justify-between gap-4 shadow-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {selected
              ? <>You selected <span className="font-semibold text-gray-800 dark:text-gray-200">{PERSONAS.find(p => p.id === selected)?.label}</span> — you can switch later in Settings.</>
              : 'Pick the option that fits you best to get started.'
            }
          </p>
          <button
            onClick={handleStart}
            disabled={!selected}
            className="flex-shrink-0 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Get started →
          </button>
        </div>
      </div>
    </div>
  )
}
