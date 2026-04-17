import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Tag } from 'lucide-react'
import { getMerchantAliases, saveMerchantAlias, deleteMerchantAlias } from '../api/merchantAliases'

export default function MerchantAliasesPage() {
  const qc = useQueryClient()
  const [rawPattern, setRawPattern] = useState('')
  const [displayName, setDisplayName] = useState('')

  const { data = [], isLoading } = useQuery({
    queryKey: ['merchant-aliases'],
    queryFn: getMerchantAliases,
  })

  const saveMutation = useMutation({
    mutationFn: () => saveMerchantAlias(rawPattern, displayName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['merchant-aliases'] })
      setRawPattern('')
      setDisplayName('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMerchantAlias(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merchant-aliases'] }),
  })

  return (
    <div className="p-4 sm:p-6 max-w-2xl space-y-6 bg-gray-50 dark:bg-gray-950 min-h-full">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Merchant Aliases</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Map raw transaction remarks to friendly merchant names. Used during import.
        </p>
      </div>

      {/* Add form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Add / Update Alias</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            placeholder="Raw pattern (e.g. UPI/SWIGGY)"
            value={rawPattern}
            onChange={e => setRawPattern(e.target.value)}
            className="text-sm border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
          />
          <input
            placeholder="Display name (e.g. Swiggy)"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="text-sm border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
          />
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!rawPattern.trim() || !displayName.trim() || saveMutation.isPending}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-2 rounded-lg disabled:opacity-50 transition-colors"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Alias'}
        </button>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-gray-400">Loading...</div>
        ) : data.length === 0 ? (
          <div className="p-6 text-center">
            <Tag size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-400">No aliases yet. Add one above.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {data.map(alias => (
              <div key={alias.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{alias.displayName}</p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{alias.rawPattern}</p>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(alias.id)}
                  disabled={deleteMutation.isPending}
                  className="text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                  title="Delete alias"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
