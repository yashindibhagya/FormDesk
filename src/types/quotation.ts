export type QuotationLineItem = {
  id: string
  description: string
  qty: string
  unitPrice: string
}

export type QuotationDraft = {
  quotationDate: string
  customerAddress: string
  subject: string
  lineItems: QuotationLineItem[]
  lineItemsSecondary: QuotationLineItem[]
  paymentNote: string
  closingNote: string
  signatoryLine: string
  signatoryName: string
}

export type QuotationFormData = QuotationDraft & {
  introText: string
}

export const EMPTY_QUOTATION_FORM: QuotationFormData = {
  quotationDate: '',
  customerAddress: '',
  subject: '',
  introText: '',
  lineItems: [],
  lineItemsSecondary: [],
  paymentNote: '',
  closingNote: '',
  signatoryLine: '',
  signatoryName: '',
}

export type QuotationRecord = {
  id: string
  createdAt: string
  updatedAt: string
  financialYear: string
  submissionId: string | null
  data: QuotationFormData
}

export function createEmptyLineItem(): QuotationLineItem {
  return {
    id: crypto.randomUUID(),
    description: '',
    qty: '',
    unitPrice: '',
  }
}

export function ensureLineItems(rows: QuotationLineItem[] | undefined): QuotationLineItem[] {
  if (rows?.length) return rows
  return [createEmptyLineItem()]
}

/** Parse money/qty; strips commas and trailing `/=` (common on LK invoices). */
export function parseAmount(raw: string): number {
  const cleaned = String(raw)
    .replace(/,/g, '')
    .replace(/\/=/g, '')
    .trim()
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

/** When qty is not a single number (e.g. `Normal: 5 | Left: 2`), sum embedded numbers for one unit price. */
function sumNumericTokensInQty(raw: string): number {
  const s = String(raw ?? '').trim()
  if (!s) return 0
  const matches = s.match(/\d+(?:\.\d+)?/g)
  if (!matches) return 0
  return matches.reduce((acc, t) => acc + (Number.parseFloat(t) || 0), 0)
}

export function effectiveLineQty(qty: string): number {
  const direct = parseAmount(qty)
  if (direct > 0) return direct
  return sumNumericTokensInQty(qty)
}

export function lineItemGrossAmount(row: QuotationLineItem): number {
  const q = effectiveLineQty(row.qty)
  const u = parseAmount(row.unitPrice)
  if (q <= 0 || u <= 0) return 0
  return q * u
}

export function formatLineAmount(qty: string, unitPrice: string): string {
  const q = effectiveLineQty(qty)
  const u = parseAmount(unitPrice)
  if (q <= 0 || u <= 0) return ''
  return (q * u).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Same as each invoice “Total” row: sum of line amounts (qty × unit price per line). */
export function sumLineAmounts(lineItems: QuotationLineItem[]): number {
  let sum = 0
  for (const row of lineItems) {
    sum += lineItemGrossAmount(row)
  }
  return sum
}
