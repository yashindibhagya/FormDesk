import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  clearSessionUser,
  readSessionUser,
  SHARED_LOGIN_PASSWORD,
  writeSessionUser,
  type SessionUser,
} from '../lib/appSessionAuth'
import { isAllowedSignInEmail } from '../lib/authAllowlist'
import { firebaseApp } from '../lib/firebase'

type AuthContextValue = {
  user: SessionUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOutUser: () => void
  authEnabled: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => readSessionUser())
  const loading = false

  const signIn = useCallback(async (email: string, password: string) => {
    const trimmed = email.trim()
    if (!isAllowedSignInEmail(trimmed)) {
      throw new Error('This email is not authorized to use this app.')
    }
    if (password !== SHARED_LOGIN_PASSWORD) {
      throw new Error('Invalid email or password.')
    }
    writeSessionUser(trimmed)
    setUser({ email: trimmed.toLowerCase() })
  }, [])

  const signOutUser = useCallback(() => {
    clearSessionUser()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: firebaseApp ? user : null,
      loading,
      signIn,
      signOutUser,
      authEnabled: Boolean(firebaseApp),
    }),
    [user, loading, signIn, signOutUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
