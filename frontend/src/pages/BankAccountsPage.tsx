import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Building2, X, Check } from 'lucide-react'
import {
  getBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  type BankAccountRequest,
} from '../api/bankAccounts'
import type { BankAccount } from '../types'

export default function BankAccountsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<BankAccount | null>(null)

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: getBankAccounts,
  })

  const createMut = useMutation({
    mutationFn: createBankAccount,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-accounts'] }); setShowForm(false) },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, req }: { id: string; req: BankAccountRequest }) =>
      updateBankAccount(id, req),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-accounts'] }); setEditing(null) },
  })

  const deleteMut = useMutation({
    mutationFn: deleteBankAccount,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-accounts'] }),
  })

  const handleDelete = (id: string) => {
    if (confirm('Delete this account? All its transactions will also be deleted.')) {
      deleteMut.mutate(id)
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bank Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your linked bank accounts</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>

      {(showForm && !editing) && (
        <AccountForm
          onSubmit={(req) => createMut.mutate(req)}
          onCancel={() => setShowForm(false)}
          loading={createMut.isPending}
        />
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : accounts.length === 0 ? (
        <EmptyState onAdd={() => setShowForm(true)} />
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div key={account.id}>
              {editing?.id === account.id ? (
                <AccountForm
                  initial={account}
                  onSubmit={(req) => updateMut.mutate({ id: account.id, req })}
                  onCancel={() => setEditing(null)}
                  loading={updateMut.isPending}
                />
              ) : (
                <AccountCard
                  account={account}
                  onEdit={() => setEditing(account)}
                  onDelete={() => handleDelete(account.id)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AccountCard({
  account,
  onEdit,
  onDelete,
}: {
  account: BankAccount
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
        <Building2 className="w-5 h-5 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900">{account.bankName}</p>
        <p className="text-sm text-gray-500">
          {account.accountNumberMasked ?? 'No account number'}
          {account.accountType ? ` · ${account.accountType}` : ''}
          {' · '}
          {account.currency}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onEdit}
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Edit"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function AccountForm({
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: BankAccount
  onSubmit: (req: BankAccountRequest) => void
  onCancel: () => void
  loading: boolean
}) {
  const [bankName, setBankName] = useState(initial?.bankName ?? '')
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumberMasked ?? '')
  const [accountType, setAccountType] = useState(initial?.accountType ?? 'Savings')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!bankName.trim()) return
    onSubmit({
      bankName: bankName.trim(),
      accountNumberMasked: accountNumber.trim() || undefined,
      accountType: accountType.trim() || undefined,
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-blue-200 p-5 space-y-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Bank Name *</label>
          <input
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. ICICI Bank"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Account Number (masked)</label>
          <input
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. XXXXXXXX1234"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Account Type</label>
          <select
            value={accountType}
            onChange={(e) => setAccountType(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option>Savings</option>
            <option>Current</option>
            <option>Salary</option>
            <option>NRI</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          {loading ? 'Saving…' : initial ? 'Save Changes' : 'Add Account'}
        </button>
      </div>
    </form>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
      <Building2 className="mx-auto w-10 h-10 text-gray-300 mb-3" />
      <p className="text-gray-500 font-medium mb-1">No bank accounts yet</p>
      <p className="text-sm text-gray-400 mb-4">
        Add an account to start importing statements
      </p>
      <button
        onClick={onAdd}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Add your first account
      </button>
    </div>
  )
}
