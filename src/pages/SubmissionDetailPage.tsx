import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SubmissionPrintDocumentShell } from '../components/submission/SubmissionPrintView'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { printOrderDocument } from '../lib/printOrderDocument'
import {
  copyElementImageToClipboard,
  downloadSubmissionPdf,
  downloadSubmissionPng,
} from '../lib/exportSubmission'
import { useSubmissionsStore } from '../store/useSubmissionsStore'

export function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const submissions = useSubmissionsStore((s) => s.submissions)
  const deleteSubmission = useSubmissionsStore((s) => s.deleteSubmission)
  const printRef = useRef<HTMLDivElement>(null)
  const toastTimerRef = useRef<number>(0)
  const [exporting, setExporting] = useState(false)
  const [copiedImage, setCopiedImage] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null,
  )

  const submission = submissions.find((s) => s.id === id)

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    window.clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
    }, 3500)
  }, [])

  const handlePrintDocument = useCallback(() => {
    printOrderDocument()
  }, [])

  const exportBaseName = useMemo(() => {
    if (!submission) return 'order'
    return `formflow-${submission.data.orderName.replace(/\s+/g, '-').slice(0, 40) || 'order'}`
  }, [submission])

  const handlePdf = useCallback(async () => {
    if (!printRef.current || !submission) return
    setExporting(true)
    try {
      await downloadSubmissionPdf(printRef.current, exportBaseName)
      showToast('PDF downloaded.', 'success')
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not build PDF. Try again or use another browser.'
      showToast(message.length > 200 ? `${message.slice(0, 197)}…` : message, 'error')
    } finally {
      setExporting(false)
    }
  }, [submission, showToast, exportBaseName])

  const handleDownloadPng = useCallback(async () => {
    if (!printRef.current || !submission) return
    setExporting(true)
    try {
      await downloadSubmissionPng(printRef.current, exportBaseName)
      showToast('PNG downloaded.', 'success')
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not save image. Try another browser or use Print / Save as PDF.'
      showToast(message.length > 200 ? `${message.slice(0, 197)}…` : message, 'error')
    } finally {
      setExporting(false)
    }
  }, [submission, showToast, exportBaseName])

  const handleCopyImage = useCallback(async () => {
    if (!printRef.current) return
    try {
      await copyElementImageToClipboard(printRef.current)
      setCopiedImage(true)
      showToast('Form copied as image. Paste it where images are supported.', 'success')
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not copy image. Use Download PNG or try another browser.'
      showToast(
        message.length > 200 ? `${message.slice(0, 197)}…` : message,
        'error',
      )
    } finally {
      window.setTimeout(() => setCopiedImage(false), 2000)
    }
  }, [showToast])

  if (!submission) {
    return (
      <Card className="text-center">
        <p className="text-slate-600">This submission was not found.</p>
        <div className="mt-4">
          <Button to="/" variant="secondary">
            Back to dashboard
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      <div className="no-print flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link to="/" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{submission.data.orderName}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Job {submission.data.jobNo} · {submission.data.ownerName}
          </p>
        </div>
        <div className="flex w-full max-w-md flex-col gap-3 lg:max-w-sm lg:shrink-0">
          <Button
            type="button"
            className="w-full py-3 text-base shadow-md"
            onClick={handlePrintDocument}
          >
            Print / Save as PDF
          </Button>
          <Button
            type="button"
            className="w-full py-3 text-base shadow-md"
            onClick={handleCopyImage}
            disabled={copiedImage || exporting}
          >
            {copiedImage ? 'Copied image' : 'Copy as image'}
          </Button>
          <Button
            type="button"
            className="w-full py-3 text-base shadow-md"
            onClick={handleDownloadPng}
            disabled={exporting}
          >
            {exporting ? 'Building…' : 'Download PNG'}
          </Button>
          <Button to={`/quotation/${submission.id}`} className="w-full py-3 text-base shadow-md" variant="secondary">
            Open quotation
          </Button>
          <Button to={`/invoice/${submission.id}`} className="w-full py-3 text-base shadow-md" variant="secondary">
            Open invoice
          </Button>
          <Button
            type="button"
            variant="danger"
            className="w-full"
            onClick={() => {
              if (!window.confirm('Delete this submission? This cannot be undone.')) return
              void deleteSubmission(submission.id)
                .then(() => navigate('/', { replace: true }))
                .catch(() => {
                  window.alert('Could not delete. Check Firebase rules and your connection.')
                })
            }}
          >
            Delete
          </Button>
          <details className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium text-slate-700">More export options</summary>
            <div className="mt-2">
              <Button type="button" variant="secondary" className="w-full" onClick={handlePdf} disabled={exporting}>
                {exporting ? 'Building…' : 'Download image PDF'}
              </Button>
            </div>
          </details>
        </div>
      </div>

      <SubmissionPrintDocumentShell submission={submission} printRef={printRef} />

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className={`no-print fixed bottom-6 left-1/2 z-[100] max-w-[min(90vw,28rem)] -translate-x-1/2 rounded-lg px-4 py-3 text-sm shadow-lg ${
            toast.type === 'success'
              ? 'bg-slate-900 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  )
}

