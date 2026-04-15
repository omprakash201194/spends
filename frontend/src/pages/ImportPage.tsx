import { useState, useRef, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Copy } from 'lucide-react'
import { importIciciFiles, type ImportResult } from '../api/importStatements'
import { clsx } from 'clsx'

export default function ImportPage() {
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const importMut = useMutation({
    mutationFn: importIciciFiles,
    onSuccess: (data) => {
      setResult(data)
      setFiles([])
    },
  })

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
    </div>
  )
}

function ImportSummary({ result }: { result: ImportResult }) {
  return (
    <div className="mt-6 space-y-4">
      {/* Totals */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <h2 className="font-semibold text-gray-900">Import Complete</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Imported"
            value={result.totalImported}
            color="text-green-600"
            bg="bg-green-50"
          />
          <StatCard
            label="Duplicates skipped"
            value={result.totalDuplicates}
            color="text-amber-600"
            bg="bg-amber-50"
          />
          <StatCard
            label="Errors"
            value={result.totalErrors}
            color="text-red-600"
            bg="bg-red-50"
          />
        </div>
      </div>

      {/* Per-file breakdown */}
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
                {f.errors > 0 && (
                  <span className="text-red-600">{f.errors} err</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
  bg,
}: {
  label: string
  value: number
  color: string
  bg: string
}) {
  return (
    <div className={clsx('rounded-lg p-4 text-center', bg)}>
      <p className={clsx('text-2xl font-bold', color)}>{value.toLocaleString()}</p>
      <p className="text-xs text-gray-600 mt-1">{label}</p>
    </div>
  )
}
