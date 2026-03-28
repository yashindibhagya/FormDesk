/** Lowercase emails allowed to sign in. */
const ALLOWED_SIGN_IN_EMAILS = new Set([
  'mawprint@gmail.com',
  'yashindibhagya@gmail.com',
])

export function isAllowedSignInEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ALLOWED_SIGN_IN_EMAILS.has(email.trim().toLowerCase())
}
