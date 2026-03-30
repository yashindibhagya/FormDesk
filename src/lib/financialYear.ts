export const FINANCIAL_YEAR_TIMEZONE = 'Asia/Colombo'

/** FY label as YYYY-YYYY for April 1 to March 31. */
export function getFinancialYearLabel(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(date.getTime())) {
    const now = new Date()
    return `${now.getUTCFullYear()}-${now.getUTCFullYear() + 1}`
  }

  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: FINANCIAL_YEAR_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

  const [yearStr, monthStr] = ymd.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const startYear = month >= 4 ? year : year - 1
  return `${startYear}-${startYear + 1}`
}

export function getCurrentFinancialYearLabel(now: Date = new Date()): string {
  return getFinancialYearLabel(now)
}

export function isWithinLastNDays(iso: string, days: number, now: Date = new Date()): boolean {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return false
  const msInDay = 24 * 60 * 60 * 1000
  return t >= now.getTime() - days * msInDay
}
