import { effectiveLineQty, parseAmount, sumLineAmounts } from '../types/quotation'
import type { InvoiceRecord } from '../types/invoice'
import type { QuotationLineItem } from '../types/quotation'
import type { Submission } from '../types/survey'

export type MonthSummaryRow = {
  key: string
  label: string
  /** Sum of qty for Banner orders in this month (from invoice lines when present, else order form). */
  bannerQuantity: number
  /** Sum of qty for Flag orders in this month. */
  flagQuantity: number
  /** Sum of qty for other print types in this month. */
  otherQuantity: number
  submissionIds: string[]
  /**
   * Sum of invoice **Total** rows for invoices **dated** in this month (`invoiceDate`, else saved time).
   * Matches the printed invoice; not tied to which month the order was created.
   */
  invoiceGrossTotal: number
  /** Sum of invoice **Balance** for those same invoices. */
  invoiceBalanceTotal: number
}

function monthKeyFromCreatedAt(iso: string): string {
  const d = new Date(iso)
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    return `${y}-${String(m).padStart(2, '0')}`
  }
  const m = iso.trim().match(/^(\d{4})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}`
  return 'unknown'
}

function formatMonthLabel(key: string): string {
  if (key === 'unknown') return 'Unknown date'
  const [ys, ms] = key.split('-')
  const y = Number(ys)
  const m = Number(ms)
  if (!y || !m) return key
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

function classifyPrintType(raw: string): 'banner' | 'flag' | 'other' {
  const t = raw.trim().toLowerCase()
  if (t.includes('banner')) return 'banner'
  if (t.includes('flag')) return 'flag'
  return 'other'
}

function sumInvoiceLineQuantities(lineItems: QuotationLineItem[]): number {
  let sum = 0
  for (const row of lineItems) {
    sum += effectiveLineQty(row.qty)
  }
  return sum
}

function quantityFromSurvey(s: Submission): number {
  const d = s.data
  if (classifyPrintType(d.printType || '') === 'banner') {
    return (
      parseAmount(d.quantityNormal) +
      parseAmount(d.quantityLeft) +
      parseAmount(d.quantityRight)
    )
  }
  return parseAmount(d.quantity)
}

/** Prefer invoice line qty totals; if none, use quantities from the saved order. */
function resolvedQuantityForOrder(s: Submission, inv: InvoiceRecord | undefined): number {
  const lines = inv?.data?.lineItems
  if (lines?.length) {
    const fromInvoice = sumInvoiceLineQuantities(lines)
    if (fromInvoice > 0) return fromInvoice
  }
  return quantityFromSurvey(s)
}

/** Map submission id → invoice (order invoices use document id = submission id; `submissionId` also set when saved from an order). */
function buildInvoiceBySubmissionId(
  invoices: InvoiceRecord[],
  submissions: Submission[],
): Map<string, InvoiceRecord> {
  const submissionIdSet = new Set(submissions.map((s) => s.id))
  const map = new Map<string, InvoiceRecord>()

  for (const inv of invoices) {
    if (inv.submissionId && submissionIdSet.has(inv.submissionId)) {
      map.set(inv.submissionId, inv)
    }
    if (submissionIdSet.has(inv.id)) {
      map.set(inv.id, inv)
    }
  }
  return map
}

/** Month bucket for dashboard money: uses invoice form date (YYYY-MM-DD) when set, else last saved time. */
function monthKeyForInvoice(inv: InvoiceRecord): string {
  const raw = inv.data.invoiceDate?.trim()
  if (raw && /^\d{4}-\d{2}/.test(raw)) {
    return raw.slice(0, 7)
  }
  if (raw) {
    const k = monthKeyFromCreatedAt(raw)
    if (k !== 'unknown') return k
  }
  return monthKeyFromCreatedAt(inv.updatedAt)
}

function aggregateInvoiceMoneyByMonth(invoices: InvoiceRecord[]): Map<string, { gross: number; balance: number }> {
  const map = new Map<string, { gross: number; balance: number }>()
  for (const inv of invoices) {
    const key = monthKeyForInvoice(inv)
    if (key === 'unknown') continue
    const gross = sumLineAmounts(inv.data.lineItems)
    const adv = parseAmount(inv.data.advance)
    const balance = gross > 0 ? (adv > 0 ? Math.max(0, gross - adv) : gross) : 0
    const cur = map.get(key) ?? { gross: 0, balance: 0 }
    cur.gross += gross
    cur.balance += balance
    map.set(key, cur)
  }
  return map
}

export function buildMonthlyOrderSummaries(
  submissions: Submission[],
  invoices: InvoiceRecord[],
): MonthSummaryRow[] {
  const invBySub = buildInvoiceBySubmissionId(invoices, submissions)
  const moneyByMonth = aggregateInvoiceMoneyByMonth(invoices)

  const buckets = new Map<string, Omit<MonthSummaryRow, 'invoiceGrossTotal' | 'invoiceBalanceTotal'>>()

  for (const s of submissions) {
    const key = monthKeyFromCreatedAt(s.createdAt)
    let row = buckets.get(key)
    if (!row) {
      row = {
        key,
        label: formatMonthLabel(key),
        bannerQuantity: 0,
        flagQuantity: 0,
        otherQuantity: 0,
        submissionIds: [],
      }
      buckets.set(key, row)
    }
    row.submissionIds.push(s.id)
    const kind = classifyPrintType(s.data.printType || '')
    const qty = resolvedQuantityForOrder(s, invBySub.get(s.id))
    if (kind === 'banner') row.bannerQuantity += qty
    else if (kind === 'flag') row.flagQuantity += qty
    else row.otherQuantity += qty
  }

  for (const key of moneyByMonth.keys()) {
    if (key === 'unknown') continue
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: formatMonthLabel(key),
        bannerQuantity: 0,
        flagQuantity: 0,
        otherQuantity: 0,
        submissionIds: [],
      })
    }
  }

  const result: MonthSummaryRow[] = []
  for (const row of buckets.values()) {
    const money = moneyByMonth.get(row.key) ?? { gross: 0, balance: 0 }
    result.push({ ...row, invoiceGrossTotal: money.gross, invoiceBalanceTotal: money.balance })
  }

  return result.filter((r) => r.key !== 'unknown').sort((a, b) => b.key.localeCompare(a.key))
}

export function formatMoneyAmount(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatQuantityDisplay(n: number): string {
  if (!Number.isFinite(n)) return '0'
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n))
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}
