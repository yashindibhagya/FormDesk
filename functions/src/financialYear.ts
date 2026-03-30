const TZ = 'Asia/Colombo'

export function getFinancialYearLabel(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(date.getTime())) {
    const y = new Date().getUTCFullYear()
    return `${y}-${y + 1}`
  }
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
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
