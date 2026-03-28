/** Same rules as `src/lib/fiscalYearRetention.ts` (self-contained for the Functions bundle). */

const FISCAL_TZ = 'Asia/Colombo'

export function currentFiscalYearRetentionCutoffIso(now: Date = new Date()): string {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: FISCAL_TZ,
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
