import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import letterheadUrl from '../assets/Quotation.jpg'
import { InvoiceTemplate } from '../components/invoice/InvoiceTemplate'
import { SubmissionPrintDocumentShell } from '../components/submission/SubmissionPrintView'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { FormField } from '../components/ui/FormField'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import {
  copyElementImageToClipboard,
  copyOrderAndDocumentImageToClipboard,
  downloadOrderAndLetterheadDocumentPdf,
} from '../lib/exportSubmission'
import { printOrderDocument } from '../lib/printOrderDocument'
import { useInvoicesStore } from '../store/useInvoicesStore'
import { useSubmissionsStore } from '../store/useSubmissionsStore'
import type { InvoiceFormData, InvoiceRecord } from '../types/invoice'
import type { SurveyFormData } from '../types/survey'
import { createEmptyLineItem, type QuotationLineItem } from '../types/quotation'

const DEFAULT_INTRO =
  'Please find below the invoice in respect of the above. Kindly arrange settlement as per the amounts shown.'

const DEFAULT_CLOSING =
  'Please contact the undersigned if you require clarification. Thank you for your patronage.'

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function formatDisplayDate(iso: string): string {
  if (!iso?.trim()) return ''
  const parts = iso.trim().split('-').map(Number)
  const y = parts[0]
  const m = parts[1]
  const d = parts[2]
  if (!y || !m || !d) return iso.trim()
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

function formatQuantityForLine(data: SurveyFormData): string {
  if (data.printType === 'Banner') {
    const n = data.quantityNormal?.trim()
    const l = data.quantityLeft?.trim()
    const r = data.quantityRight?.trim()
    if (n || l || r) return `Normal: ${n || '—'} | Left: ${l || '—'} | Right: ${r || '—'}`
  }
  return data.quantity?.trim() || ''
}

function buildLineFromSubmission(data: SurveyFormData): QuotationLineItem {
  const parts = [
    data.printDescription?.trim(),
    data.fabric ? `Fabric: ${data.fabric}` : '',
    data.sizeHeight || data.sizeWidth ? `Size: H ${data.sizeHeight || '—'} × W ${data.sizeWidth || '—'}` : '',
    data.method ? `Method: ${data.method}` : '',
  ].filter(Boolean)
  return {
    id: crypto.randomUUID(),
    description: parts.join('\n') || '—',
    qty: formatQuantityForLine(data) || '1',
    unitPrice: '',
  }
}

export function InvoicePage() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const navigate = useNavigate()
  const submissions = useSubmissionsStore((s) => s.submissions)
  const submissionsReady = useSubmissionsStore((s) => s.firestoreReady)
  const submission = invoiceId ? submissions.find((s) => s.id === invoiceId) : undefined
  const savedInvoice = useInvoicesStore((s) =>
    invoiceId ? s.invoices.find((i) => i.id === invoiceId) : undefined,
  )
  const firestoreReady = useInvoicesStore((s) => s.firestoreReady)
  const invoicesFirestoreError = useInvoicesStore((s) => s.firestoreError)
  const saveInvoiceToStore = useInvoicesStore((s) => s.saveInvoice)

  const [invoiceDate, setInvoiceDate] = useState(todayIsoDate)
  const [customerAddress, setCustomerAddress] = useState('')
  const [introText, setIntroText] = useState(DEFAULT_INTRO)
  const [lineItems, setLineItems] = useState<QuotationLineItem[]>(() => [createEmptyLineItem()])
  const [advance, setAdvance] = useState('')
  const [closingNote, setClosingNote] = useState(DEFAULT_CLOSING)
  const [signatoryLine, setSignatoryLine] = useState('MAW PRINTING')
  const [signatoryName, setSignatoryName] = useState('M. A. W. Priyadarshana')
  const [saving, setSaving] = useState(false)
  const surveyCaptureRef = useRef<HTMLDivElement>(null)
  const invoiceCaptureRef = useRef<HTMLDivElement>(null)
  const toastTimerRef = useRef<number>(0)
  const [copiedImage, setCopiedImage] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const appliedSavedSig = useRef<string | null>(null)
  const hydratedSubmissionKey = useRef<string | null>(null)

  const resetFormToDefaults = useCallback(() => {
    setInvoiceDate(todayIsoDate())
    setCustomerAddress('')
    setIntroText(DEFAULT_INTRO)
    setLineItems([createEmptyLineItem()])
    setAdvance('')
    setClosingNote(DEFAULT_CLOSING)
    setSignatoryLine('MAW PRINTING')
    setSignatoryName('M. A. W. Priyadarshana')
  }, [])

  const hydrateFromRecord = useCallback((record: InvoiceRecord) => {
    const d = record.data
    setInvoiceDate(d.invoiceDate?.trim() || todayIsoDate())
    setCustomerAddress(d.customerAddress ?? '')
    setIntroText(d.introText?.trim() ? d.introText : DEFAULT_INTRO)
    setLineItems(d.lineItems?.length ? d.lineItems : [createEmptyLineItem()])
    setAdvance(d.advance ?? '')
    setClosingNote(d.closingNote?.trim() ? d.closingNote : DEFAULT_CLOSING)
    setSignatoryLine(d.signatoryLine?.trim() ? d.signatoryLine : 'MAW PRINTING')
    setSignatoryName(d.signatoryName?.trim() ? d.signatoryName : 'M. A. W. Priyadarshana')
  }, [])

  const hydrateFromSubmission = useCallback((data: SurveyFormData) => {
    setInvoiceDate(data.orderDate?.trim() || todayIsoDate())
    setCustomerAddress(data.address?.trim() || '')
    setLineItems([buildLineFromSubmission(data)])
  }, [])

  useEffect(() => {
    if (!invoiceId) {
      appliedSavedSig.current = null
      hydratedSubmissionKey.current = null
      resetFormToDefaults()
      return
    }

    if (savedInvoice) {
      hydratedSubmissionKey.current = null
      const sig = `${savedInvoice.id}:${savedInvoice.updatedAt}`
      if (appliedSavedSig.current !== sig) {
        hydrateFromRecord(savedInvoice)
        appliedSavedSig.current = sig
      }
      return
    }

    appliedSavedSig.current = null
    const sub = submissions.find((s) => s.id === invoiceId)
    if (sub) {
      if (hydratedSubmissionKey.current !== invoiceId) {
        hydrateFromSubmission(sub.data)
        hydratedSubmissionKey.current = invoiceId
      }
      return
    }

    hydratedSubmissionKey.current = null
  }, [invoiceId, savedInvoice, submissions, resetFormToDefaults, hydrateFromRecord, hydrateFromSubmission])

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    window.clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
    }, 3500)
  }, [])

  const invoiceDateDisplay = useMemo(() => formatDisplayDate(invoiceDate), [invoiceDate])

  const buildFormData = useCallback((): InvoiceFormData => {
    return {
      invoiceDate,
      customerAddress,
      introText,
      lineItems,
      advance,
      closingNote,
      signatoryLine,
      signatoryName,
    }
  }, [
    invoiceDate,
    customerAddress,
    introText,
    lineItems,
    advance,
    closingNote,
    signatoryLine,
    signatoryName,
  ])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const data = buildFormData()
      const id = await saveInvoiceToStore({
        id: invoiceId,
        submissionId: submission?.id ?? null,
        data,
      })
      if (!invoiceId) {
        navigate(`/invoice/${id}`, { replace: true })
      }
      showToast('Invoice saved.', 'success')
    } catch {
      showToast('Could not save invoice. Deploy Firestore rules and check your connection.', 'error')
    } finally {
      setSaving(false)
    }
  }, [
    buildFormData,
    invoiceId,
    navigate,
    saveInvoiceToStore,
    showToast,
    submission?.id,
  ])

  const addRow = useCallback(() => {
    setLineItems((rows) => [...rows, createEmptyLineItem()])
  }, [])

  const removeRow = useCallback((id: string) => {
    setLineItems((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.id !== id)))
  }, [])

  const updateLine = useCallback((id: string, patch: Partial<Omit<QuotationLineItem, 'id'>>) => {
    setLineItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }, [])

  const handlePrint = useCallback(() => {
    printOrderDocument()
  }, [])

  const invoicePdfBaseName = useMemo(() => {
    const date = invoiceDate?.trim() || todayIsoDate()
    const id = invoiceId ? `-${invoiceId.slice(0, 8)}` : ''
    return `invoice-${date}${id}`
  }, [invoiceDate, invoiceId])

  const handleDownloadPdf = useCallback(async () => {
    const invEl = invoiceCaptureRef.current
    if (!invEl) return
    setDownloadingPdf(true)
    try {
      await downloadOrderAndLetterheadDocumentPdf(
        submission ? surveyCaptureRef.current : null,
        invEl,
        invoicePdfBaseName,
      )
      showToast('PDF downloaded (A4 — same layout as Print: order then invoice).', 'success')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not create PDF. Try Print or another browser.'
      showToast(message.length > 200 ? `${message.slice(0, 197)}…` : message, 'error')
    } finally {
      setDownloadingPdf(false)
    }
  }, [submission, invoicePdfBaseName, showToast])

  const handleCopyImage = useCallback(async () => {
    const el = invoiceCaptureRef.current
    if (!el) return
    try {
      if (submission && surveyCaptureRef.current) {
        await copyOrderAndDocumentImageToClipboard(surveyCaptureRef.current, el)
        showToast('Order and invoice copied as one image. Paste where images are supported.', 'success')
      } else {
        await copyElementImageToClipboard(el)
        showToast('Invoice copied as image.', 'success')
      }
      setCopiedImage(true)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not copy image. Try Download PDF, Print, or another browser.'
      showToast(message.length > 200 ? `${message.slice(0, 197)}…` : message, 'error')
    } finally {
      window.setTimeout(() => setCopiedImage(false), 2000)
    }
  }, [submission, showToast])

  const backLink = invoiceId ? '/invoices' : '/'

  const notFound = useMemo(() => {
    if (!invoiceId) return false
    if (!firestoreReady || !submissionsReady) return false
    if (savedInvoice) return false
    if (submission) return false
    return true
  }, [invoiceId, firestoreReady, submissionsReady, savedInvoice, submission])

  if (notFound) {
    return (
      <Card className="text-center">
        <p className="text-slate-600">This invoice or order was not found.</p>
        <div className="mt-4">
          <Button to="/invoices" variant="secondary">
            Back to invoices
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6 print:space-y-0">
      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to={backLink} className="text-sm font-medium text-blue-600 hover:text-blue-700">
            ← {invoiceId ? 'Invoices' : 'Dashboard'}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Invoice</h1>
          {invoicesFirestoreError ? (
            <p className="mt-2 text-sm text-red-600">{invoicesFirestoreError}</p>
          ) : null}
          <p className="mt-1 text-sm text-slate-600">
            {submission
              ? 'Download PDF matches Print: A4, page 1 order summary, page 2 invoice. The order block is off-screen but included.'
              : 'Download PDF saves the invoice letterhead as A4. Save stores data in Firestore.'}
          </p>
          <p className="mt-2 max-w-xl text-sm text-slate-600">
            {submission
              ? 'Use Download PDF for a file without the print dialog. Page 1 uses the same two-column order layout as the submission screen; page 2 is the invoice.'
              : 'With no linked order, the PDF is only the invoice sheet. Link from an order to include the order confirmation on page 1.'}
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[220px]">
          <Button type="button" className="w-full py-3 shadow-md" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save invoice'}
          </Button>
          <Button
            type="button"
            className="w-full py-3 shadow-md"
            onClick={() => void handleDownloadPdf()}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? 'Creating PDF…' : 'Download PDF'}
          </Button>
          <Button type="button" variant="secondary" className="w-full py-3" onClick={handlePrint}>
            Print
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full py-3"
            onClick={handleCopyImage}
            disabled={copiedImage || downloadingPdf}
          >
            {copiedImage
              ? 'Copied'
              : submission
                ? 'Copy image (order + invoice)'
                : 'Copy as image'}
          </Button>
        </div>
      </div>

      <Card padding="sm" className="no-print space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice details</p>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Date" htmlFor="inv-date">
            <Input id="inv-date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </FormField>
          <FormField
            label="Advance paid"
            htmlFor="inv-advance"
            hint="Shown in the invoice table; balance = total − advance."
          >
            <Input
              id="inv-advance"
              value={advance}
              onChange={(e) => setAdvance(e.target.value)}
              placeholder="e.g. 25000 or 25,000.00"
            />
          </FormField>
        </div>
        <FormField label="Customer address" htmlFor="inv-addr">
          <Textarea
            id="inv-addr"
            rows={4}
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
            placeholder="Recipient name and address"
          />
        </FormField>
        <FormField label="Introduction" htmlFor="inv-intro">
          <Textarea id="inv-intro" rows={3} value={introText} onChange={(e) => setIntroText(e.target.value)} />
        </FormField>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700">Line items</p>
            <Button type="button" variant="secondary" onClick={addRow}>
              Add row
            </Button>
          </div>
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            {lineItems.map((row, index) => (
              <div
                key={row.id}
                className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-[1fr_5rem_7rem_auto] md:items-end"
              >
                <FormField label={`Description ${index + 1}`} htmlFor={`id-${row.id}`}>
                  <Textarea
                    id={`id-${row.id}`}
                    rows={2}
                    value={row.description}
                    onChange={(e) => updateLine(row.id, { description: e.target.value })}
                  />
                </FormField>
                <FormField label="Qty" htmlFor={`iq-${row.id}`}>
                  <Input
                    id={`iq-${row.id}`}
                    value={row.qty}
                    onChange={(e) => updateLine(row.id, { qty: e.target.value })}
                  />
                </FormField>
                <FormField label="Unit price" htmlFor={`iu-${row.id}`}>
                  <Input
                    id={`iu-${row.id}`}
                    value={row.unitPrice}
                    onChange={(e) => updateLine(row.id, { unitPrice: e.target.value })}
                  />
                </FormField>
                <div className="flex justify-end md:pb-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={lineItems.length <= 1}
                    onClick={() => removeRow(row.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <FormField label="Closing paragraph" htmlFor="inv-close">
          <Textarea id="inv-close" rows={4} value={closingNote} onChange={(e) => setClosingNote(e.target.value)} />
        </FormField>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Sign-off line" htmlFor="inv-sign1">
            <Input id="inv-sign1" value={signatoryLine} onChange={(e) => setSignatoryLine(e.target.value)} />
          </FormField>
          <FormField label="Signatory name" htmlFor="inv-sign2">
            <Input id="inv-sign2" value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} />
          </FormField>
        </div>
      </Card>

      {submission ? (
        <div className="quotation-pack-survey-offscreen" aria-hidden>
          <SubmissionPrintDocumentShell submission={submission} printRef={surveyCaptureRef} />
        </div>
      ) : null}

      <div ref={invoiceCaptureRef} className="print:m-0 print:p-0">
        <InvoiceTemplate
          letterheadUrl={letterheadUrl}
          invoiceDateDisplay={invoiceDateDisplay}
          customerAddress={customerAddress}
          introText={introText}
          lineItems={lineItems}
          advance={advance}
          closingNote={closingNote}
          signatoryLine={signatoryLine}
          signatoryName={signatoryName}
        />
      </div>

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className={`no-print fixed bottom-6 left-1/2 z-[100] max-w-[min(90vw,28rem)] -translate-x-1/2 rounded-lg px-4 py-3 text-sm shadow-lg ${toast.type === 'success' ? 'bg-slate-900 text-white' : 'bg-red-600 text-white'
            }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  )
}
