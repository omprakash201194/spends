import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Key, Trash2, Check, ExternalLink } from 'lucide-react'
import { getSettings, saveApiKey, deleteApiKey } from '../api/settings'

export default function SettingsPage() {
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  })

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
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account preferences</p>
      </div>

      {/* Claude API key card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Key className="w-4 h-4 text-purple-500" />
          <h2 className="text-sm font-semibold text-gray-800">Anthropic API Key</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">
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
            <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 font-mono">
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
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-400"
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

        <p className="text-xs text-gray-400 mt-3">
          Your key is stored securely and only used to generate insights on demand. It is never shared.
        </p>
      </div>
    </div>
  )
}
