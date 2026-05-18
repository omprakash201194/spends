import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function OAuth2CallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setError('No token received from Google login')
      return
    }

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load user profile')
        return res.json()
      })
      .then((user) => {
        setAuth({
          token,
          tokenType: 'Bearer',
          userId: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          householdId: user.householdId,
          householdName: user.householdName,
        })
        navigate('/', { replace: true })
      })
      .catch(() => {
        setError('Google login failed — please try again')
      })
  }, [params, navigate, setAuth])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <a href="/login" className="text-blue-600 hover:underline text-sm">Back to login</a>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span>Completing sign-in...</span>
      </div>
    </div>
  )
}
