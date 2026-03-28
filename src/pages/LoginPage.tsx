import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/ui/Button'
import { FormField } from '../components/ui/FormField'
import { Input } from '../components/ui/Input'

function redirectPath(state: unknown): string {
  if (
    typeof state === 'object' &&
    state !== null &&
    'from' in state &&
    typeof (state as { from: unknown }).from === 'string'
  ) {
    const path = (state as { from: string }).from
    return path.startsWith('/') ? path : '/'
  }
  return '/'
}

export function LoginPage() {
  const { user, loading, signIn, firebaseConfigured } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = redirectPath(location.state)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Sign-in failed. Check your email and password.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-xl font-semibold text-slate-900">FormFlow</h1>
        <p className="mt-1 text-center text-sm text-slate-600">Sign in to continue</p>

        {!firebaseConfigured ? (
          <p
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            role="status"
          >
            Cloud sync is off: Firebase env vars were missing at build time. Add{' '}
            <code className="rounded bg-amber-100/80 px-1">VITE_FIREBASE_*</code> in Vercel → Environment
            Variables, then redeploy. Until then, surveys save only in this browser.
          </p>
        ) : null}

        <form className="mt-8 space-y-5" onSubmit={(e) => void handleSubmit(e)}>
          <FormField label="Email" htmlFor="login-email" required>
            <Input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
            />
          </FormField>
          <FormField label="Password" htmlFor="login-password" required>
            <Input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
            />
          </FormField>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Access is limited to authorized accounts only.
        </p>
      </div>
    </div>
  )
}
