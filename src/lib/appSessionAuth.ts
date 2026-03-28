import { isAllowedSignInEmail } from './authAllowlist'

const STORAGE_KEY = 'formdesk_session_email'

/** Shared password for allowed accounts (Firebase Email/Password requires min 6 chars). */
export const SHARED_LOGIN_PASSWORD = '1234'

export type SessionUser = { email: string }

export function readSessionUser(): SessionUser | null {
  try {
    const email = localStorage.getItem(STORAGE_KEY)?.trim().toLowerCase() ?? ''
    if (!email || !isAllowedSignInEmail(email)) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return { email }
  } catch {
    return null
  }
}

export function writeSessionUser(email: string): void {
  localStorage.setItem(STORAGE_KEY, email.trim().toLowerCase())
}

export function clearSessionUser(): void {
  localStorage.removeItem(STORAGE_KEY)
}
