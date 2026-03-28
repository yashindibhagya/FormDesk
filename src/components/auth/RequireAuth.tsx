import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-slate-50 text-sm text-slate-600">
        Signing in…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
