import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Tag, Loader2 } from 'lucide-react'
import { getTransactionTags } from '../api/tags'
import { type Category } from '../api/categories'
import CategoryRulePicker from './CategoryRulePicker'

export default function TagsPanel({
  onTagClick,
  categories,
}: {
  onTagClick: (tag: string) => void
  categories: Category[]
}) {
  const [search, setSearch] = useState('')
  const [pickerTag, setPickerTag] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['transaction-tags'],
    queryFn: getTransactionTags,
    staleTime: 5 * 60_000,
  })

  const tags = (data?.tags ?? []).filter(t =>
    !search || t.tag.includes(search.toLowerCase())
  )

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Tag className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Tags</h3>
        {data && (
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
            {data.tags.length} found
          </span>
        )}
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text"
          placeholder="Filter tags…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {isLoading ? (
        <div className="py-6 text-center">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400 mx-auto" />
        </div>
      ) : tags.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
          {search ? 'No matching tags' : 'No tags extracted yet'}
        </p>
      ) : (
        <div className="space-y-0.5 max-h-80 overflow-y-auto -mx-1 px-1">
          {tags.map(({ tag, count }) => (
            <div key={tag} className="relative group flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              <button
                onClick={() => onTagClick(tag)}
                className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                title={`Filter by "${tag}"`}
              >
                <span className="text-xs font-mono text-gray-700 dark:text-gray-200 truncate">{tag}</span>
                <span className="ml-auto flex-shrink-0 text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                  ×{count}
                </span>
              </button>

              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <div className="relative">
                  <button
                    onClick={() => setPickerTag(pickerTag === tag ? null : tag)}
                    title="Assign to category"
                    className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                  >
                    <Tag className="w-3.5 h-3.5" />
                  </button>
                  {pickerTag === tag && (
                    <CategoryRulePicker
                      tag={tag}
                      categories={categories}
                      onClose={() => setPickerTag(null)}
                      onApplied={() => setPickerTag(null)}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        Click tag to filter · <Tag className="w-3 h-3 inline" /> assign category
      </p>
    </div>
  )
}
