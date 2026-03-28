/** Time zone for “1 April → 31 March” fiscal boundaries (change if your business uses another zone). */
export const FISCAL_YEAR_TIMEZONE = 'Asia/Colombo'

/**
 * ISO instant for the start of the fiscal year currently in effect in `FISCAL_YEAR_TIMEZONE`.
 * Keep Firestore docs whose string `createdAt` is >= this value; purge older (see Cloud Function).
 */
export function currentFiscalYearRetentionCutoffIso(now: Date = new Date()): string {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: FISCAL_YEAR_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const [yStr, mStr] = ymd.split('-')
  const y = Number(yStr)
  const m = Number(mStr)
  const startYear = m >= 4 ? y : y - 1
  return new Date(`${startYear}-04-01T00:00:00+05:30`).toISOString()
}
