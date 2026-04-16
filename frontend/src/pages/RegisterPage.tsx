import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { TrendingUp, Eye, EyeOff } from 'lucide-react'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import type { RegisterRequest } from '../types'

type Mode = 'create' | 'join'

export default function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [mode, setMode] = useState<Mode>('create')
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState<RegisterRequest>({
    username: '',
    email: '',
    password: '',
    displayName: '',
    householdName: '',
    inviteCode: '',
  })

  const { mutate: register, isPending, error } = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      setAuth(data)
      navigate('/')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: RegisterRequest = {
      username: form.username,
      email: form.email,
      password: form.password,
      displayName: form.displayName,
    }
    if (mode === 'create') {
      payload.householdName = form.householdName
    } else {
      payload.inviteCode = form.inviteCode
    }
    register(payload)
  }

  const fieldErrors =
    error && (error as { response?: { data?: { errors?: Record<string, string> } } }).response?.data?.errors
  const generalError =
    error && (error as { response?: { data?: { message?: string } } }).response?.data?.message

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-6 py-12">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          <span className="text-lg font-bold text-gray-900 dark:text-white">SpendStack</span>
        </div>

        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Create your account</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track expenses across your household.</p>

        {/* Household mode toggle */}
        <div className="mt-5 flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === 'create'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            New household
          </button>
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === 'join'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Join existing
          </button>
        </div>

        {generalError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {generalError}
          </div>
        )}

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          {/* Household name or invite code */}
          {mode === 'create' ? (
            <Field
              label="Household name"
              placeholder="e.g. Gautam Family"
              value={form.householdName ?? ''}
              onChange={(v) => setForm({ ...form, householdName: v })}
              error={fieldErrors?.householdName}
            />
          ) : (
            <Field
              label="Invite code"
              placeholder="8-character code"
              value={form.inviteCode ?? ''}
              onChange={(v) => setForm({ ...form, inviteCode: v })}
              error={fieldErrors?.inviteCode}
            />
          )}

          <Field
            label="Display name"
            placeholder="Om Gautam"
            value={form.displayName}
            onChange={(v) => setForm({ ...form, displayName: v })}
            error={fieldErrors?.displayName}
          />

          <Field
            label="Username"
            placeholder="om_gautam"
            value={form.username}
            onChange={(v) => setForm({ ...form, username: v })}
            error={fieldErrors?.username}
          />

          <Field
            label="Email"
            type="email"
            placeholder="om@example.com"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
            error={fieldErrors?.email}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Min 8 characters"
                className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors?.password && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {isPending ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-sm text-center text-gray-500 dark:text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  error,
  type = 'text',
}: {
  label: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  error?: string
  type?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{label}</label>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
