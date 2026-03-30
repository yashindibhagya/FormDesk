import { createEmptyLineItem, type QuotationLineItem } from './quotation'

export type InvoiceFormData = {
  invoiceDate: string
  customerAddress: string
  introText: string
  lineItems: QuotationLineItem[]
  advance: string
  closingNote: string
  signatoryLine: string
  signatoryName: string
}

export const EMPTY_INVOICE_FORM: InvoiceFormData = {
  invoiceDate: '',
  customerAddress: '',
  introText: '',
  lineItems: [],
  advance: '',
  closingNote: '',
  signatoryLine: '',
  signatoryName: '',
}

export type InvoiceRecord = {
  id: string
  createdAt: string
  updatedAt: string
  financialYear: string
  /** Order this invoice was opened from, if any; null for standalone invoices. */
  submissionId: string | null
  data: InvoiceFormData
}

export function ensureLineItems(rows: QuotationLineItem[] | undefined): QuotationLineItem[] {
  if (rows?.length) return rows
  return [createEmptyLineItem()]
}
