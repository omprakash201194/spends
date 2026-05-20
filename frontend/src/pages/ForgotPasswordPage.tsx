import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import apiClient from '../api/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await apiClient.post('/auth/forgot-password', { email })
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          <span className="text-lg font-bold text-gray-900 dark:text-white">SpendStack</span>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Forgot password</h1>

          {submitted ? (
            <div className="space-y-4 mt-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                If <span className="font-medium">{email}</span> is registered, you'll receive a reset link shortly. Check your inbox and spam folder.
              </p>
              <Link to="/login" className="block text-center text-sm text-blue-600 hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Enter your email and we'll send you a link to reset your password.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
                    placeholder="you@example.com"
                  />
                </div>

                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
                <Link to="/login" className="text-blue-600 hover:underline">Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
