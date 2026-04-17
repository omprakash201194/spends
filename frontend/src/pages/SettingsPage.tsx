import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Key, Trash2, Check, ExternalLink, AlertTriangle, Bell, Sliders } from 'lucide-react'
import { getSettings, saveApiKey, deleteApiKey, saveNotificationEmail, getPreferences, savePreferences } from '../api/settings'
import {
  deleteAllTransactions as apiDeleteTransactions,
  deleteAllRules as apiDeleteRules,
  deleteAllBudgets as apiDeleteBudgets,
  deleteAllViews as apiDeleteViews,
  deleteAllCustomCategories as apiDeleteCustomCategories,
} from '../api/dangerZone'

// ── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'apikey' | 'notifications' | 'preferences' | 'danger'

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('apikey')

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your account preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl w-fit">
        {([
          { id: 'apikey',        label: 'API Key',       icon: Key           },
          { id: 'notifications', label: 'Notifications', icon: Bell          },
          { id: 'preferences',  label: 'Preferences',   icon: Sliders       },
          { id: 'danger',       label: 'Danger Zone',   icon: AlertTriangle },
        ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'apikey'        && <ApiKeyTab />}
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'preferences'   && <PreferencesTab />}
      {tab === 'danger'        && <DangerZoneTab />}
    </div>
  )
}

// ── Tab: API Key ──────────────────────────────────────────────────────────────

function ApiKeyTab() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const [keyInput, setKeyInput] = useState('')
  const [saved, setSaved]       = useState(false)

  const saveMutation = useMutation({
    mutationFn: saveApiKey,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      setKeyInput('')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteApiKey,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })

  const hasKey = data?.hasApiKey ?? false

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Key className="w-4 h-4 text-purple-500" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Anthropic API Key</h2>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
        Used to generate AI insights on your spending.{' '}
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline inline-flex items-center gap-0.5"
        >
          Get a key <ExternalLink className="w-3 h-3" />
        </a>
      </p>

      {hasKey ? (
        <div className="flex items-center gap-3">
          <div className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 font-mono">
            sk-ant-••••••••••••••••••••••
          </div>
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            placeholder="sk-ant-api03-..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
            onKeyDown={e => {
              if (e.key === 'Enter' && keyInput.trim()) saveMutation.mutate(keyInput.trim())
            }}
          />
          <button
            onClick={() => saveMutation.mutate(keyInput.trim())}
            disabled={!keyInput.trim() || saveMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saved ? <Check className="w-4 h-4" /> : 'Save'}
          </button>
        </div>
      )}

      {saved && (
        <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
          <Check className="w-3.5 h-3.5" /> API key saved successfully
        </p>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
        Your key is stored securely and only used to generate insights on demand. It is never shared.
      </p>
    </div>
  )
}

// ── Tab: Notifications ────────────────────────────────────────────────────────

function NotificationsTab() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const [emailInput, setEmailInput] = useState(data?.notificationEmail ?? '')
  const [saved, setSaved] = useState(false)

  const saveMutation = useMutation({
    mutationFn: () => saveNotificationEmail(emailInput.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const clearMutation = useMutation({
    mutationFn: () => saveNotificationEmail(''),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      setEmailInput('')
    },
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Bell className="w-4 h-4 text-blue-500" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Anomaly Digest Email</h2>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
        Receive a daily email alert at 8am for transactions over ₹10,000. Leave blank to disable.
      </p>

      <div className="flex items-center gap-2">
        <input
          type="email"
          value={emailInput}
          onChange={e => setEmailInput(e.target.value)}
          placeholder="email@example.com"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
          onKeyDown={e => {
            if (e.key === 'Enter') saveMutation.mutate()
          }}
        />
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {saved ? <Check className="w-4 h-4" /> : 'Save'}
        </button>
        {data?.notificationEmail && (
          <button
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove
          </button>
        )}
      </div>

      {saved && (
        <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
          <Check className="w-3.5 h-3.5" /> Notification email saved
        </p>
      )}
      {data?.notificationEmail && !saved && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Currently sending to <span className="font-medium text-gray-600 dark:text-gray-300">{data.notificationEmail}</span>
        </p>
      )}
    </div>
  )
}

// ── Tab: Preferences ─────────────────────────────────────────────────────────

function PreferencesTab() {
  const qc = useQueryClient()
  const { data: prefs } = useQuery({
    queryKey: ['preferences'],
    queryFn: getPreferences,
  })
  const [depth, setDepth] = useState<number | ''>(prefs?.maxCategoryDepth ?? 5)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (prefs?.maxCategoryDepth !== undefined) setDepth(prefs.maxCategoryDepth)
  }, [prefs?.maxCategoryDepth])

  const saveMutation = useMutation({
    mutationFn: () => savePreferences(Number(depth)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['preferences'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Sliders className="w-4 h-4 text-blue-500" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Category Preferences</h2>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
        Configure how categories behave across your household.
      </p>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Max Category Depth
          </label>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
            Maximum levels of parent-child nesting allowed (1 = root only, 5 = up to 5 levels deep).
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={10}
              value={depth}
              onChange={e => setDepth(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={depth === '' || (typeof depth === 'number' && (depth < 1 || depth > 10)) || saveMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saved ? <Check className="w-4 h-4" /> : 'Save'}
            </button>
          </div>
          {saved && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Preference saved
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tab: Danger Zone ──────────────────────────────────────────────────────────

interface DangerActionConfig {
  key: string
  title: string
  description: string
  mutationFn: () => Promise<void>
  invalidateKeys: string[][]
}

function DangerZoneTab() {
  const qc = useQueryClient()

  const actions: DangerActionConfig[] = [
    {
      key: 'transactions',
      title: 'Delete all transactions',
      description: 'Permanently deletes every transaction and import record across all your bank accounts. This cannot be undone.',
      mutationFn: apiDeleteTransactions,
      invalidateKeys: [['transactions'], ['dashboard'], ['budgets'], ['recurring'], ['import-history'], ['data-health'], ['views']],
    },
    {
      key: 'rules',
      title: 'Delete all categorization rules',
      description: 'Removes all your keyword rules. Auto-categorization will fall back to the global rules only.',
      mutationFn: apiDeleteRules,
      invalidateKeys: [['category-rules']],
    },
    {
      key: 'budgets',
      title: 'Delete all budget limits',
      description: 'Removes every budget limit you have set. Historical spending data is unaffected.',
      mutationFn: apiDeleteBudgets,
      invalidateKeys: [['budgets']],
    },
    {
      key: 'views',
      title: 'Delete all views',
      description: 'Removes all trip and event views for your household. The underlying transactions are not deleted.',
      mutationFn: apiDeleteViews,
      invalidateKeys: [['views']],
    },
    {
      key: 'custom-categories',
      title: 'Delete all custom categories',
      description: 'Removes all custom categories created by your household. Transactions assigned to them will lose their category.',
      mutationFn: apiDeleteCustomCategories,
      invalidateKeys: [['categories'], ['transactions'], ['data-health']],
    },
  ]

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-5 py-4">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
          <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">Danger Zone</h2>
        </div>
        <p className="text-xs text-red-600 dark:text-red-500">
          These actions are permanent and cannot be undone. Each requires you to type DELETE to confirm.
        </p>
      </div>
      {actions.map(action => (
        <DangerActionCard
          key={action.key}
          action={action}
          onSuccess={() => action.invalidateKeys.forEach(k => qc.invalidateQueries({ queryKey: k }))}
        />
      ))}
    </div>
  )
}

function DangerActionCard({
  action,
  onSuccess,
}: {
  action: DangerActionConfig
  onSuccess: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [input, setInput]           = useState('')
  const [done, setDone]             = useState(false)

  const mutation = useMutation({
    mutationFn: action.mutationFn,
    onSuccess: () => {
      onSuccess()
      setConfirming(false)
      setInput('')
      setDone(true)
      setTimeout(() => setDone(false), 4000)
    },
  })

  const cancel = () => {
    setConfirming(false)
    setInput('')
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{action.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{action.description}</p>
        </div>
        {!confirming && !done && (
          <button
            onClick={() => setConfirming(true)}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          >
            Delete
          </button>
        )}
        {done && (
          <span className="flex-shrink-0 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="w-3.5 h-3.5" /> Done
          </span>
        )}
      </div>

      {confirming && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Type <span className="font-mono font-bold text-red-600 dark:text-red-400">DELETE</span> to confirm:
          </p>
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="DELETE"
              className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
              onKeyDown={e => {
                if (e.key === 'Enter' && input === 'DELETE') mutation.mutate()
                if (e.key === 'Escape') cancel()
              }}
            />
            <button
              onClick={() => mutation.mutate()}
              disabled={input !== 'DELETE' || mutation.isPending}
              className="px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-40 transition-colors"
            >
              {mutation.isPending ? '…' : 'Confirm'}
            </button>
            <button
              onClick={cancel}
              className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg"
            >
              Cancel
            </button>
          </div>
          {mutation.isError && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
              Something went wrong. Please try again.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

