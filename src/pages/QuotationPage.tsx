import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import letterheadUrl from '../assets/Quotation.jpg'
import { QuotationTemplate } from '../components/quotation/QuotationTemplate'
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
import { useQuotationsStore } from '../store/useQuotationsStore'
import { useSubmissionsStore } from '../store/useSubmissionsStore'
import type { SurveyFormData } from '../types/survey'
import {
  createEmptyLineItem,
  type QuotationFormData,
  type QuotationLineItem,
  type QuotationRecord,
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
  const navigate = useNavigate()
  const submissions = useSubmissionsStore((s) => s.submissions)
  const submissionsReady = useSubmissionsStore((s) => s.firestoreReady)
  const submission = submissionId ? submissions.find((s) => s.id === submissionId) : undefined
  const savedQuotation = useQuotationsStore((s) =>
    submissionId ? s.quotations.find((q) => q.id === submissionId) : undefined,
  )
  const firestoreReady = useQuotationsStore((s) => s.firestoreReady)
  const quotationsFirestoreError = useQuotationsStore((s) => s.firestoreError)
  const saveQuotationToStore = useQuotationsStore((s) => s.saveQuotation)

  const [quotationDate, setQuotationDate] = useState(todayIsoDate)
  const [customerAddress, setCustomerAddress] = useState('')
  const [subject, setSubject] = useState('')
  const [introText, setIntroText] = useState(DEFAULT_INTRO)
  const [lineItems, setLineItems] = useState<QuotationLineItem[]>(() => [createEmptyLineItem()])
  const [paymentNote, setPaymentNote] = useState(DEFAULT_PAYMENT)
  const [closingNote, setClosingNote] = useState(DEFAULT_CLOSING)
  const [signatoryLine, setSignatoryLine] = useState('MAW PRINTING')
  const [signatoryName, setSignatoryName] = useState('M. A. W. Priyadarshana')
  const [saving, setSaving] = useState(false)
  const surveyCaptureRef = useRef<HTMLDivElement>(null)
  const quotationCaptureRef = useRef<HTMLDivElement>(null)
  const toastTimerRef = useRef<number>(0)
  const [copiedImage, setCopiedImage] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null,
  )
  const appliedSavedSig = useRef<string | null>(null)
  const hydratedSubmissionKey = useRef<string | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    window.clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
    }, 3500)
  }, [])

  const resetFormToDefaults = useCallback(() => {
    setQuotationDate(todayIsoDate())
    setCustomerAddress('')
    setSubject('')
    setIntroText(DEFAULT_INTRO)
    setLineItems([createEmptyLineItem()])
    setPaymentNote(DEFAULT_PAYMENT)
    setClosingNote(DEFAULT_CLOSING)
    setSignatoryLine('MAW PRINTING')
    setSignatoryName('M. A. W. Priyadarshana')
  }, [])

  const hydrateFromRecord = useCallback((record: QuotationRecord) => {
    const d = record.data
    setQuotationDate(d.quotationDate?.trim() || todayIsoDate())
    setCustomerAddress(d.customerAddress ?? '')
    setSubject(d.subject ?? '')
    setIntroText(d.introText?.trim() ? d.introText : DEFAULT_INTRO)
    setLineItems(d.lineItems?.length ? d.lineItems : [createEmptyLineItem()])
    setPaymentNote(d.paymentNote?.trim() ? d.paymentNote : DEFAULT_PAYMENT)
    setClosingNote(d.closingNote?.trim() ? d.closingNote : DEFAULT_CLOSING)
    setSignatoryLine(d.signatoryLine?.trim() ? d.signatoryLine : 'MAW PRINTING')
    setSignatoryName(d.signatoryName?.trim() ? d.signatoryName : 'M. A. W. Priyadarshana')
  }, [])

  const hydrateFromSubmission = useCallback((data: SurveyFormData) => {
    setQuotationDate(data.orderDate?.trim() || todayIsoDate())
    setCustomerAddress(data.address?.trim() || '')
    const subj = [data.printType, data.orderName].filter(Boolean).join(' – ')
    setSubject(subj ? subj.toUpperCase() : 'ITEMS')
    setLineItems([buildLineFromSubmission(data)])
  }, [])

  useEffect(() => {
    if (!submissionId) {
      appliedSavedSig.current = null
      hydratedSubmissionKey.current = null
      resetFormToDefaults()
      return
    }

    if (savedQuotation) {
      hydratedSubmissionKey.current = null
      const sig = `${savedQuotation.id}:${savedQuotation.updatedAt}`
      if (appliedSavedSig.current !== sig) {
        hydrateFromRecord(savedQuotation)
        appliedSavedSig.current = sig
      }
      return
    }

    appliedSavedSig.current = null
    if (submission) {
      if (hydratedSubmissionKey.current !== submissionId) {
        hydrateFromSubmission(submission.data)
        hydratedSubmissionKey.current = submissionId
      }
      return
    }

    hydratedSubmissionKey.current = null
  }, [
    submissionId,
    savedQuotation,
    submission,
    resetFormToDefaults,
    hydrateFromRecord,
    hydrateFromSubmission,
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

  const quotationPdfBaseName = useMemo(() => {
    const date = quotationDate?.trim() || todayIsoDate()
    const subj = subject?.trim().replace(/\s+/g, '-') || 'quotation'
    const id = submissionId ? `-${submissionId.slice(0, 8)}` : ''
    return `quotation-${date}-${subj}${id}`
  }, [quotationDate, subject, submissionId])

  const buildFormData = useCallback((): QuotationFormData => {
    return {
      quotationDate,
      customerAddress,
      subject,
      introText,
      lineItems,
      paymentNote,
      closingNote,
      signatoryLine,
      signatoryName,
    }
  }, [
    quotationDate,
    customerAddress,
    subject,
    introText,
    lineItems,
    paymentNote,
    closingNote,
    signatoryLine,
    signatoryName,
  ])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const data = buildFormData()
      const id = await saveQuotationToStore({
        id: submissionId,
        submissionId: submission?.id ?? null,
        data,
      })
      if (!submissionId) {
        navigate(`/quotation/${id}`, { replace: true })
      }
      showToast('Quotation saved.', 'success')
    } catch {
      showToast('Could not save quotation. Deploy Firestore rules and check your connection.', 'error')
    } finally {
      setSaving(false)
    }
  }, [buildFormData, navigate, saveQuotationToStore, showToast, submission?.id, submissionId])

  const handleDownloadPdf = useCallback(async () => {
    const qEl = quotationCaptureRef.current
    if (!qEl) return
    setDownloadingPdf(true)
    try {
      await downloadOrderAndLetterheadDocumentPdf(
        submission ? surveyCaptureRef.current : null,
        qEl,
        quotationPdfBaseName,
      )
      showToast('PDF downloaded (same layout as Print: A4, order then quotation).', 'success')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not create PDF. Try Print or another browser.'
      showToast(message.length > 200 ? `${message.slice(0, 197)}…` : message, 'error')
    } finally {
      setDownloadingPdf(false)
    }
  }, [submission, quotationPdfBaseName, showToast])

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
          : 'Could not copy image. Try Download PDF, Print, or another browser.'
      showToast(message.length > 200 ? `${message.slice(0, 197)}…` : message, 'error')
    } finally {
      window.setTimeout(() => setCopiedImage(false), 2000)
    }
  }, [submission, showToast])

  const backLink = submissionId ? '/quotations' : '/'

  const missingSubmission = useMemo(() => {
    if (!submissionId) return false
    if (!firestoreReady || !submissionsReady) return false
    if (savedQuotation) return false
    if (submission) return false
    return true
  }, [submissionId, firestoreReady, submissionsReady, savedQuotation, submission])

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
          {quotationsFirestoreError ? (
            <p className="mt-2 text-sm text-red-600">{quotationsFirestoreError}</p>
          ) : null}
          <p className="mt-1 text-sm text-slate-600">
            {submission
              ? 'Download PDF matches Print: A4, page 1 order summary, page 2 quotation. The order block is off-screen but included. Or use Print / copy image.'
              : 'Download PDF saves the quotation as A4. With a linked order, page 1 is the order and page 2 is the quotation.'}
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[220px]">
          <Button type="button" className="w-full py-3 shadow-md" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save quotation'}
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
