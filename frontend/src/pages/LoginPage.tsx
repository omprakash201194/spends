import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { TrendingUp, Eye, EyeOff } from 'lucide-react'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import type { LoginRequest } from '../types'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [form, setForm] = useState<LoginRequest>({ username: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)

  const { mutate: login, isPending, error } = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setAuth(data)
      navigate('/')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    login(form)
  }

  const errorMessage =
    error && (error as { response?: { data?: { message?: string } } }).response?.data?.message

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-900 flex-col justify-between p-12">
        <div className="flex items-center gap-2 text-white">
          <TrendingUp className="w-7 h-7 text-blue-400" />
          <span className="text-xl font-bold">SpendStack</span>
        </div>
        <div>
          <blockquote className="text-2xl font-semibold text-white leading-snug">
            "Know where your money goes before it's gone."
          </blockquote>
          <p className="mt-4 text-gray-400 text-sm">
            Personal expense tracking for your household — powered by your homelab.
          </p>
        </div>
        <p className="text-xs text-gray-600">© {new Date().getFullYear()} SpendStack</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white dark:bg-gray-800">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <span className="text-lg font-bold text-gray-900 dark:text-white">SpendStack</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sign in</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Welcome back — let's see where the money went.</p>

          {errorMessage && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Username</label>
              <input
                type="text"
                required
                autoComplete="username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
                placeholder="your_username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {isPending ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
            <span className="text-xs text-gray-400 dark:text-gray-500">or</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
          </div>

          <a
            href="/api/oauth2/authorization/google"
            className="mt-4 flex items-center justify-center gap-3 w-full py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </a>

          <p className="mt-6 text-sm text-center text-gray-500 dark:text-gray-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-600 font-medium hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
