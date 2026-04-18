import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, LayoutGrid } from 'lucide-react'
import {
  getWidgets, createWidget, updateWidget, deleteWidget, getWidgetData,
  type Widget, type CreateWidgetRequest,
} from '../api/widgets'
import WidgetForm from '../components/WidgetForm'
import WidgetRenderer from '../components/WidgetRenderer'

function WidgetCard({ widget, onEdit, onDelete }: {
  widget: Widget
  onEdit: () => void
  onDelete: () => void
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['widget-data', widget.id],
    queryFn: () => getWidgetData(widget.id),
    staleTime: 60_000,
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900 dark:text-white text-sm">{widget.title}</h3>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="h-32 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {isError && (
        <div className="h-32 flex items-center justify-center text-sm text-red-500">
          Failed to load data
        </div>
      )}
      {data && <WidgetRenderer data={data} color={widget.color} />}

      <div className="mt-2 flex gap-1.5 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
          {widget.widgetType}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
          {widget.periodMonths}m
        </span>
        {widget.filterType !== 'ALL' && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300">
            {widget.filterType}
          </span>
        )}
      </div>
    </div>
  )
}

export default function CustomDashboardPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Widget | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: widgets = [], isLoading } = useQuery({
    queryKey: ['widgets'],
    queryFn: getWidgets,
    staleTime: 30_000,
  })

  const createMut = useMutation({
    mutationFn: createWidget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets'] })
      setShowForm(false)
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, req }: { id: string; req: CreateWidgetRequest }) =>
      updateWidget(id, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets'] })
      setEditing(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: deleteWidget,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['widgets'] })
      queryClient.removeQueries({ queryKey: ['widget-data', id] })
      setDeletingId(null)
    },
  })

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <LayoutGrid className="w-6 h-6 text-indigo-500" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">My Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Custom widgets powered by your transactions</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add widget
        </button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-72 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && widgets.length === 0 && (
        <div className="text-center py-20">
          <LayoutGrid className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-gray-500 dark:text-gray-400 font-medium mb-2">No widgets yet</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
            Add your first widget to visualise your spending
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
          >
            Add widget
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {widgets.map(w => (
          <WidgetCard
            key={w.id}
            widget={w}
            onEdit={() => setEditing(w)}
            onDelete={() => setDeletingId(w.id)}
          />
        ))}
      </div>

      {showForm && (
        <WidgetForm
          onSave={req => createMut.mutate(req)}
          onClose={() => setShowForm(false)}
        />
      )}

      {editing && (
        <WidgetForm
          existing={editing}
          onSave={req => updateMut.mutate({ id: editing.id, req })}
          onClose={() => setEditing(null)}
        />
      )}

      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Delete widget?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              This widget will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate(deletingId)}
                disabled={deleteMut.isPending}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
