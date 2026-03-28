const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Calendar date as DD.MM.YYYY (local). Accepts YYYY-MM-DD from forms/storage or a parseable date/ISO string.
 */
export function formatDateDotDMY(input: string | null | undefined): string {
  const s = input?.trim()
  if (!s) return ''
  const m = ISO_DATE_ONLY.exec(s)
  if (m) {
    const [, y, mo, d] = m
    return `${d}.${mo}.${y}`
  }
  const t = Date.parse(s)
  if (Number.isNaN(t)) return s
  const dt = new Date(t)
  return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`
}

/** Instant as DD.MM.YYYY, HH:mm (24h, local). */
export function formatDateTimeDotDMY(iso: string | null | undefined): string {
  const s = iso?.trim()
  if (!s) return ''
  const t = Date.parse(s)
  if (Number.isNaN(t)) return s
  const dt = new Date(t)
  const datePart = `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`
  const timePart = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
  return `${datePart}, ${timePart}`
}
