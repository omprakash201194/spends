import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Trash2, Plus, Users, ChevronDown, ChevronRight } from 'lucide-react'
import {
  getSettlements, createSettlement, markSettled, deleteSettlement,
  type Settlement, type CreateSettlementItem
} from '../api/settlements'

function SettlementCard({ settlement, onMarkSettled, onDelete }: {
  settlement: Settlement
  onMarkSettled: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isOpen = settlement.status === 'OPEN'

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow border-l-4 ${isOpen ? 'border-amber-400' : 'border-green-500'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900 dark:text-white">{settlement.participantName}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                isOpen
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                  : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
              }`}>
                {settlement.status}
              </span>
            </div>
            {settlement.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{settlement.description}</p>
            )}
          </div>
          <div className="text-right">
            <p className={`text-lg font-bold ${isOpen ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
              ₹{settlement.totalOwed.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-gray-400">
              {isOpen ? 'you owe' : 'settled'}
            </p>
          </div>
        </div>

        {settlement.items.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mt-2"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {settlement.items.length} item{settlement.items.length !== 1 ? 's' : ''}
          </button>
        )}

        {expanded && (
          <div className="mt-3 space-y-1 border-t border-gray-100 dark:border-gray-700 pt-3">
            {settlement.items.map(item => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">{item.description}</span>
                <span className="text-gray-500 dark:text-gray-400">
                  ₹{item.yourShare.toLocaleString('en-IN')} of ₹{item.totalAmount.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          {isOpen && (
            <button
              onClick={() => onMarkSettled(settlement.id)}
              className="flex items-center gap-1.5 text-xs bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900 dark:hover:bg-green-800 dark:text-green-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              <CheckCircle size={12} />
              Mark Settled
            </button>
          )}
          <button
            onClick={() => onDelete(settlement.id)}
            className="flex items-center gap-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: any) => void }) {
  const [participantName, setParticipantName] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<CreateSettlementItem[]>([
    { description: '', totalAmount: 0, yourShare: 0 }
  ])

  const updateItem = (i: number, field: keyof CreateSettlementItem, value: string | number) =>
    setItems(items.map((item, j) => j === i ? { ...item, [field]: value } : item))

  const handleSubmit = () => {
    if (!participantName.trim()) return
    const validItems = items.filter(item => item.description.trim() && item.totalAmount > 0)
    onCreate({ participantName, description: description || undefined, items: validItems })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Settlement</h2>
        </div>
        <div className="p-5 space-y-4 max-h-96 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">With</label>
            <input
              placeholder="Person's name"
              value={participantName}
              onChange={e => setParticipantName(e.target.value)}
              className="w-full text-sm border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description (optional)</label>
            <input
              placeholder="e.g. Goa trip, Dinner at XYZ..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full text-sm border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Items</label>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 mb-2">
                <input
                  placeholder="Description"
                  value={item.description}
                  onChange={e => updateItem(i, 'description', e.target.value)}
                  className="col-span-3 text-xs border rounded-lg px-2 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <input
                  type="number" placeholder="Total"
                  value={item.totalAmount || ''}
                  onChange={e => updateItem(i, 'totalAmount', parseFloat(e.target.value) || 0)}
                  className="text-xs border rounded-lg px-2 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <input
                  type="number" placeholder="Your share"
                  value={item.yourShare || ''}
                  onChange={e => updateItem(i, 'yourShare', parseFloat(e.target.value) || 0)}
                  className="text-xs border rounded-lg px-2 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
            ))}
            <button
              onClick={() => setItems([...items, { description: '', totalAmount: 0, yourShare: 0 }])}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              + Add item
            </button>
          </div>
        </div>
        <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!participantName.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-2 rounded-lg disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SettlementsPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const { data = [], isLoading } = useQuery({
    queryKey: ['settlements'],
    queryFn: getSettlements,
  })

  const createMutation = useMutation({
    mutationFn: createSettlement,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settlements'] }); setShowCreate(false) },
  })

  const markSettledMutation = useMutation({
    mutationFn: markSettled,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settlements'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSettlement,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settlements'] }),
  })

  const open = data.filter(s => s.status === 'OPEN')
  const settled = data.filter(s => s.status === 'SETTLED')

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-gray-50 dark:bg-gray-950 min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settlements</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track shared expenses and split costs</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg"
        >
          <Plus size={16} />
          New Settlement
        </button>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : data.length === 0 ? (
        <div className="text-center py-16">
          <Users size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No settlements yet.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Create one to track shared expenses.</p>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                Open ({open.length})
              </h2>
              {open.map(s => (
                <SettlementCard
                  key={s.id}
                  settlement={s}
                  onMarkSettled={id => markSettledMutation.mutate(id)}
                  onDelete={id => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          )}
          {settled.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                Settled ({settled.length})
              </h2>
              {settled.map(s => (
                <SettlementCard
                  key={s.id}
                  settlement={s}
                  onMarkSettled={id => markSettledMutation.mutate(id)}
                  onDelete={id => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={data => createMutation.mutate(data)}
        />
      )}
    </div>
  )
}
