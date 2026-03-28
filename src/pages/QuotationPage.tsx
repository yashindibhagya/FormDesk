import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import letterheadUrl from '../assets/Quotation.jpg'
import { QuotationTemplate } from '../components/quotation/QuotationTemplate'
import { SubmissionPrintDocumentShell } from '../components/submission/SubmissionPrintView'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { FormField } from '../components/ui/FormField'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { copyElementImageToClipboard, copyOrderAndDocumentImageToClipboard } from '../lib/exportSubmission'
import { printOrderDocument } from '../lib/printOrderDocument'
import { useSubmissionsStore } from '../store/useSubmissionsStore'
import type { SurveyFormData } from '../types/survey'
import {
  createEmptyLineItem,
  type QuotationLineItem,
} from '../types/quotation'

const DEFAULT_INTRO =
  'Further to the discussion there undersigned had with you regarding the above. We take a pleasure in forwarding our quotation for same as follows.'

const DEFAULT_PAYMENT =
  '***A kind request to pay 60% of the total amount as a advance payment. As well as cash on delivery.***'

const DEFAULT_CLOSING =
  'Please contact the undersigned if you require clarification in this connection. We hope to have made a compressive offer and look forward to receiving valid order. Assuring you of our best services fullest support at all times.'

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function formatQuantityForQuotation(data: SurveyFormData): string {
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
    qty: formatQuantityForQuotation(data) || '1',
    unitPrice: '',
  }
}

export function QuotationPage() {
  const { submissionId } = useParams<{ submissionId: string }>()
  const submissions = useSubmissionsStore((s) => s.submissions)
  const submission = submissionId ? submissions.find((s) => s.id === submissionId) : undefined

  const [quotationDate, setQuotationDate] = useState(todayIsoDate)
  const [customerAddress, setCustomerAddress] = useState('')
  const [subject, setSubject] = useState('')
  const [introText, setIntroText] = useState(DEFAULT_INTRO)
  const [lineItems, setLineItems] = useState<QuotationLineItem[]>(() => [createEmptyLineItem()])
  const [paymentNote, setPaymentNote] = useState(DEFAULT_PAYMENT)
  const [closingNote, setClosingNote] = useState(DEFAULT_CLOSING)
  const [signatoryLine, setSignatoryLine] = useState('MAW PRINTING')
  const [signatoryName, setSignatoryName] = useState('M. A. W. Priyadarshana')
  const [didPrefill, setDidPrefill] = useState(false)
  const surveyCaptureRef = useRef<HTMLDivElement>(null)
  const quotationCaptureRef = useRef<HTMLDivElement>(null)
  const toastTimerRef = useRef<number>(0)
  const [copiedImage, setCopiedImage] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null,
  )

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    window.clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
    }, 3500)
  }, [])

  useEffect(() => {
    if (!submission || didPrefill) return
    const d = submission.data
    setQuotationDate(d.orderDate?.trim() || todayIsoDate())
    setCustomerAddress(d.address?.trim() || '')
    const subj = [d.printType, d.orderName].filter(Boolean).join(' – ')
    setSubject(subj ? subj.toUpperCase() : 'ITEMS')
    setLineItems([buildLineFromSubmission(d)])
    setDidPrefill(true)
  }, [submission, didPrefill])

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

  const handleCopyImage = useCallback(async () => {
    const qEl = quotationCaptureRef.current
    if (!qEl) return
    try {
      if (submission && surveyCaptureRef.current) {
        await copyOrderAndDocumentImageToClipboard(surveyCaptureRef.current, qEl)
        showToast('Order and quotation copied as one image. Paste where images are supported.', 'success')
      } else {
        await copyElementImageToClipboard(qEl)
        showToast('Quotation copied as image.', 'success')
      }
      setCopiedImage(true)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not copy image. Try Print / Save as PDF or another browser.'
      showToast(message.length > 200 ? `${message.slice(0, 197)}…` : message, 'error')
    } finally {
      window.setTimeout(() => setCopiedImage(false), 2000)
    }
  }, [submission, showToast])

  const backLink = submissionId ? '/quotations' : '/'

  const missingSubmission = useMemo(() => {
    if (!submissionId) return false
    return !submission
  }, [submissionId, submission])

  if (missingSubmission) {
    return (
      <Card className="text-center">
        <p className="text-slate-600">This order was not found.</p>
        <div className="mt-4">
          <Button to="/quotations" variant="secondary">
            Back to quotations
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
            ← {submissionId ? 'Quotations' : 'Dashboard'}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Quotation</h1>
          <p className="mt-1 text-sm text-slate-600">
            {submission
              ? 'Print or copy image: page 1 is the order summary, page 2 is the quotation. The order block is hidden on screen but included in print and copy.'
              : 'Edit the fields below; the preview uses your letterhead image. Print or copy the quotation.'}
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[220px]">
          <Button type="button" className="w-full py-3 shadow-md" onClick={handlePrint}>
            Print / Save as PDF
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full py-3"
            onClick={handleCopyImage}
            disabled={copiedImage}
          >
            {copiedImage
              ? 'Copied'
              : submission
                ? 'Copy image (order + quotation)'
                : 'Copy as image'}
          </Button>
        </div>
      </div>

      <Card padding="sm" className="no-print space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quotation details</p>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Date" htmlFor="q-date">
            <Input id="q-date" type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)} />
          </FormField>
          <FormField label="Subject (appears after QUOTATION FOR)" htmlFor="q-subject">
            <Input
              id="q-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. BANNERS"
            />
          </FormField>
        </div>
        <FormField label="Customer address" htmlFor="q-addr">
          <Textarea
            id="q-addr"
            rows={4}
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
            placeholder="Recipient name and address"
          />
        </FormField>
        <FormField label="Introduction" htmlFor="q-intro">
          <Textarea id="q-intro" rows={3} value={introText} onChange={(e) => setIntroText(e.target.value)} />
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
              <div key={row.id} className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-[1fr_5rem_7rem_auto] md:items-end">
                <FormField label={`Description ${index + 1}`} htmlFor={`d-${row.id}`}>
                  <Textarea
                    id={`d-${row.id}`}
                    rows={2}
                    value={row.description}
                    onChange={(e) => updateLine(row.id, { description: e.target.value })}
                  />
                </FormField>
                <FormField label="Qty" htmlFor={`q-${row.id}`}>
                  <Input
                    id={`q-${row.id}`}
                    value={row.qty}
                    onChange={(e) => updateLine(row.id, { qty: e.target.value })}
                  />
                </FormField>
                <FormField label="Unit price" htmlFor={`u-${row.id}`}>
                  <Input
                    id={`u-${row.id}`}
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

        <FormField label="Payment terms" htmlFor="q-pay">
          <Textarea id="q-pay" rows={2} value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} />
        </FormField>
        <FormField label="Closing paragraph" htmlFor="q-close">
          <Textarea id="q-close" rows={4} value={closingNote} onChange={(e) => setClosingNote(e.target.value)} />
        </FormField>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Sign-off line" htmlFor="q-sign1">
            <Input id="q-sign1" value={signatoryLine} onChange={(e) => setSignatoryLine(e.target.value)} />
          </FormField>
          <FormField label="Signatory name" htmlFor="q-sign2">
            <Input id="q-sign2" value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} />
          </FormField>
        </div>
      </Card>

      {submission ? (
        <div className="quotation-pack-survey-offscreen" aria-hidden>
          <SubmissionPrintDocumentShell submission={submission} printRef={surveyCaptureRef} />
        </div>
      ) : null}

      <div ref={quotationCaptureRef} className="print:m-0 print:p-0">
        <QuotationTemplate
          letterheadUrl={letterheadUrl}
          quotationDate={quotationDate}
          customerAddress={customerAddress}
          subject={subject}
          introText={introText}
          lineItems={lineItems}
          paymentNote={paymentNote}
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
