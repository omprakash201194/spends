import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { LayoutGrid, Plus, Pencil, Trash2, X, Check, Copy } from 'lucide-react'
import {
  getDashboards, createDashboard, renameDashboard, deleteDashboard, duplicateDashboard,
  type Dashboard,
} from '../api/dashboards'

function DashboardCard({ dashboard, onDelete }: { dashboard: Dashboard; onDelete: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(dashboard.name)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const renameMut = useMutation({
    mutationFn: (n: string) => renameDashboard(dashboard.id, n),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] })
      setRenaming(false)
    },
  })

  const duplicateMut = useMutation({
    mutationFn: () => duplicateDashboard(dashboard.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboards'] }),
  })

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-3 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors group"
      onClick={() => !renaming && !confirmDelete && navigate(`/dashboards/${dashboard.id}`)}
    >
      <div className="flex items-start justify-between gap-2">
        <LayoutGrid className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
        {renaming ? (
          <div className="flex-1 flex gap-1.5" onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') renameMut.mutate(name)
                if (e.key === 'Escape') { setName(dashboard.name); setRenaming(false) }
              }}
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              onClick={() => renameMut.mutate(name)}
              disabled={!name.trim() || renameMut.isPending}
              className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setName(dashboard.name); setRenaming(false) }}
              className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <h3 className="flex-1 font-semibold text-gray-900 dark:text-white text-base leading-tight">
            {dashboard.name}
          </h3>
        )}
        {!renaming && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => duplicateMut.mutate()}
              disabled={duplicateMut.isPending}
              title="Duplicate"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setRenaming(true)}
              title="Rename"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete"
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Created {new Date(dashboard.createdAt).toLocaleDateString()}
      </p>

      {confirmDelete && (
        <div className="mt-1 p-3 bg-red-50 dark:bg-red-950 rounded-lg" onClick={e => e.stopPropagation()}>
          <p className="text-sm text-red-700 dark:text-red-300 mb-2">Delete this dashboard and all its widgets?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={onDelete}
              className="flex-1 px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardListPage() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')

  const { data: dashboards = [], isLoading } = useQuery({
    queryKey: ['dashboards'],
    queryFn: getDashboards,
    staleTime: 30_000,
  })

  const createMut = useMutation({
    mutationFn: createDashboard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] })
      setShowCreate(false)
      setNewName('')
    },
  })

  const deleteMut = useMutation({
    mutationFn: deleteDashboard,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboards'] }),
  })

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <LayoutGrid className="w-6 h-6 text-indigo-500" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">My Dashboards</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Custom widget layouts</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New dashboard
        </button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && dashboards.length === 0 && (
        <div className="text-center py-20">
          <LayoutGrid className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-gray-500 dark:text-gray-400 font-medium mb-2">No dashboards yet</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
            Create a dashboard and add custom widgets to visualise your spending
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
          >
            New dashboard
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {dashboards.map(d => (
          <DashboardCard
            key={d.id}
            dashboard={d}
            onDelete={() => deleteMut.mutate(d.id)}
          />
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">New dashboard</h3>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newName.trim()) createMut.mutate(newName.trim())
                if (e.key === 'Escape') { setShowCreate(false); setNewName('') }
              }}
              placeholder="Dashboard name"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowCreate(false); setNewName('') }}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => createMut.mutate(newName.trim())}
                disabled={!newName.trim() || createMut.isPending}
                className="flex-1 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
