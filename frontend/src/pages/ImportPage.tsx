import { useState, useRef, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Copy, Trash2, History, Clock } from 'lucide-react'
import {
  importIciciFiles,
  getImportHistory,
  deleteImportBatch,
  deleteAllTransactions,
  type ImportResult,
  type BatchEntry,
} from '../api/importStatements'
import { clsx } from 'clsx'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Formats ISO datetime string as "16 Apr 2026, 10:30 AM" */
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // ── Import history query ────────────────────────────────────────────────────

  const { data: history = [] } = useQuery({
    queryKey: ['import-history'],
    queryFn: getImportHistory,
    staleTime: 30_000,
  })

  // ── Import mutation ─────────────────────────────────────────────────────────

  const importMut = useMutation({
    mutationFn: importIciciFiles,
    onSuccess: (data) => {
      setResult(data)
      setFiles([])
      queryClient.invalidateQueries({ queryKey: ['import-history'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      queryClient.invalidateQueries({ queryKey: ['recurring'] })
    },
  })

  // ── Delete batch mutation ───────────────────────────────────────────────────

  const deleteBatchMut = useMutation({
    mutationFn: (batchId: string) => deleteImportBatch(batchId),
    onSuccess: () => {
      setDeletingBatchId(null)
      setDeleteError(null)
      queryClient.invalidateQueries({ queryKey: ['import-history'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      queryClient.invalidateQueries({ queryKey: ['recurring'] })
    },
    onError: () => {
      setDeletingBatchId(null)
      setDeleteError('Delete failed. Please try again.')
    },
  })

  // ── Delete all mutation ─────────────────────────────────────────────────────

  const deleteAllMut = useMutation({
    mutationFn: deleteAllTransactions,
    onSuccess: () => {
      setConfirmDeleteAll(false)
      setDeleteError(null)
      queryClient.invalidateQueries({ queryKey: ['import-history'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      queryClient.invalidateQueries({ queryKey: ['recurring'] })
    },
    onError: () => {
      setConfirmDeleteAll(false)
      setDeleteError('Delete failed. Please try again.')
    },
  })

  // ── File handling ───────────────────────────────────────────────────────────

  const addFiles = useCallback((incoming: File[]) => {
    const xlsFiles = incoming.filter(
      (f) => f.name.endsWith('.xls') || f.name.endsWith('.xlsx')
    )
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name))
      return [...prev, ...xlsFiles.filter((f) => !names.has(f.name))]
    })
    setResult(null)
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      addFiles(Array.from(e.dataTransfer.files))
    },
    [addFiles]
  )

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
      e.target.value = ''
    }
  }

  const removeFile = (name: string) =>
    setFiles((prev) => prev.filter((f) => f.name !== name))

  const handleImport = () => {
    if (files.length > 0) importMut.mutate(files)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Import Statements</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload ICICI bank statement XLS/XLSX files. Duplicates are automatically skipped.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={clsx(
          'relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xls,.xlsx"
          multiple
          className="hidden"
          onChange={onFileInput}
        />
        <Upload className="mx-auto w-10 h-10 text-gray-400 mb-3" />
        <p className="text-gray-700 font-medium">Drop XLS / XLSX files here</p>
        <p className="text-sm text-gray-400 mt-1">or click to browse</p>
        <p className="text-xs text-gray-400 mt-3">
          Supports ICICI Bank statement exports · Multiple files at once
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file) => (
            <div
              key={file.name}
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3"
            >
              <FileSpreadsheet className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="flex-1 text-sm text-gray-700 truncate">{file.name}</span>
              <span className="text-xs text-gray-400">
                {(file.size / 1024).toFixed(0)} KB
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(file.name) }}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          <button
            onClick={handleImport}
            disabled={importMut.isPending}
            className="w-full mt-2 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {importMut.isPending
              ? `Importing ${files.length} file${files.length > 1 ? 's' : ''}…`
              : `Import ${files.length} file${files.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Error */}
      {importMut.isError && (
        <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">
            Import failed. Please check that the files are valid ICICI XLS statements.
          </p>
        </div>
      )}

      {/* Result summary */}
      {result && <ImportSummary result={result} />}

      {/* ── Import History ──────────────────────────────────────────────────── */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">Import History</h2>
            {history.length > 0 && (
              <span className="text-xs text-gray-400">({history.length})</span>
            )}
          </div>

          {/* Delete All button / confirmation */}
          {history.length > 0 && (
            <div className="flex items-center gap-2">
              {confirmDeleteAll ? (
                <>
                  <span className="text-xs text-red-600 font-medium">Delete ALL transactions?</span>
                  <button
                    onClick={() => deleteAllMut.mutate()}
                    disabled={deleteAllMut.isPending}
                    className="text-xs px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deleteAllMut.isPending ? 'Deleting…' : 'Yes, delete all'}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteAll(false)}
                    className="text-xs px-2.5 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmDeleteAll(true)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete All Transactions
                </button>
              )}
            </div>
          )}
        </div>

        {deleteError && (
          <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{deleteError}</p>
          </div>
        )}

        {history.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl">
            <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No imports yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((batch) => (
              <BatchRow
                key={batch.id}
                batch={batch}
                isDeleting={deletingBatchId === batch.id}
                isPending={deleteBatchMut.isPending && deletingBatchId === batch.id}
                onDeleteClick={() => { setDeleteError(null); setDeletingBatchId(batch.id) }}
                onDeleteConfirm={() => deleteBatchMut.mutate(batch.id)}
                onDeleteCancel={() => setDeletingBatchId(null)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Batch row ─────────────────────────────────────────────────────────────────

function BatchRow({
  batch,
  isDeleting,
  isPending,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  batch: BatchEntry
  isDeleting: boolean
  isPending: boolean
  onDeleteClick: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <div className="flex items-start gap-3">
        <FileSpreadsheet className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{batch.filename}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {batch.bankName}
            {batch.accountNumberMasked ? ` · ${batch.accountNumberMasked}` : ''}
            {' · '}
            {fmtDateTime(batch.importedAt)}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <span className="text-xs text-green-600 font-medium">{batch.transactionCount} imported</span>
            {batch.duplicateCount > 0 && (
              <span className="text-xs text-amber-600 ml-2">{batch.duplicateCount} dup</span>
            )}
          </div>
          {!isDeleting ? (
            <button
              onClick={onDeleteClick}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete this import"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onDeleteConfirm}
                disabled={isPending}
                className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors disabled:opacity-50"
              >
                {isPending ? '…' : 'Delete'}
              </button>
              <button
                onClick={onDeleteCancel}
                className="text-xs px-2 py-1 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Import summary ────────────────────────────────────────────────────────────

function ImportSummary({ result }: { result: ImportResult }) {
  return (
    <div className="mt-6 space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <h2 className="font-semibold text-gray-900">Import Complete</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Imported"          value={result.totalImported}   color="text-green-600" bg="bg-green-50" />
          <StatCard label="Duplicates skipped" value={result.totalDuplicates} color="text-amber-600" bg="bg-amber-50" />
          <StatCard label="Errors"             value={result.totalErrors}     color="text-red-600"   bg="bg-red-50" />
        </div>
      </div>

      {result.files.length > 1 && (
        <div className="space-y-2">
          {result.files.map((f) => (
            <div
              key={f.fileName}
              className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3"
            >
              <Copy className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{f.fileName}</p>
                <p className="text-xs text-gray-500">
                  {f.bankName}
                  {f.accountNumberMasked ? ` · ${f.accountNumberMasked}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-green-600 font-medium">{f.imported} new</span>
                <span className="text-amber-600">{f.duplicates} dup</span>
                {f.errors > 0 && <span className="text-red-600">{f.errors} err</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={clsx('rounded-lg p-4 text-center', bg)}>
      <p className={clsx('text-2xl font-bold', color)}>{value.toLocaleString()}</p>
      <p className="text-xs text-gray-600 mt-1">{label}</p>
    </div>
  )
}
