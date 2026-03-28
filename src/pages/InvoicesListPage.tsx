import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { formatDateDotDMY, formatDateTimeDotDMY } from '../lib/dateDisplay'
import { firebaseDb } from '../lib/firebase'
import { useInvoicesStore } from '../store/useInvoicesStore'
import { useSubmissionsStore } from '../store/useSubmissionsStore'
import type { InvoiceRecord } from '../types/invoice'
import type { Submission } from '../types/survey'

const PRINT_TYPE_OPTIONS = ['All', 'Embroidery', 'Sublimation', 'Screen Print', 'Sticker']

function cardLines(inv: InvoiceRecord, submissionById: Map<string, Submission>) {
  const sub = inv.submissionId ? submissionById.get(inv.submissionId) : undefined
  if (sub) {
    return {
      title: sub.data.orderName,
      subtitle: `Job: ${sub.data.jobNo} - ${sub.data.ownerName}`,
      metaType: sub.data.printType || 'No type',
    }
  }
  const firstAddrLine =
    inv.data.customerAddress
      ?.split('\n')
      .map((l) => l.trim())
      .find(Boolean) ?? ''
  return {
    title: firstAddrLine || 'Standalone invoice',
    subtitle: inv.submissionId ? 'Linked order not found' : 'No linked order',
    metaType: '—',
  }
}

export function InvoicesListPage() {
  const invoices = useInvoicesStore((s) => s.invoices)
  const deleteInvoice = useInvoicesStore((s) => s.deleteInvoice)
  const firestoreReady = useInvoicesStore((s) => s.firestoreReady)
  const firestoreError = useInvoicesStore((s) => s.firestoreError)
  const submissions = useSubmissionsStore((s) => s.submissions)
  const [query, setQuery] = useState('')
  const [printType, setPrintType] = useState('All')

  const submissionById = useMemo(() => {
    const m = new Map<string, (typeof submissions)[0]>()
    for (const s of submissions) m.set(s.id, s)
    return m
  }, [submissions])

  const filtered = useMemo(() => {
    let list = [...invoices]
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter((inv) => {
        const addr = (inv.data.customerAddress ?? '').toLowerCase()
        const desc0 = inv.data.lineItems?.[0]?.description?.toLowerCase() ?? ''
        if (addr.includes(q) || desc0.includes(q) || inv.id.toLowerCase().includes(q)) return true
        const sub = inv.submissionId ? submissionById.get(inv.submissionId) : undefined
        if (!sub) return false
        const d = sub.data
        return (
          d.orderName.toLowerCase().includes(q) ||
          d.jobNo.toLowerCase().includes(q) ||
          d.ownerName.toLowerCase().includes(q) ||
          d.fabric.toLowerCase().includes(q)
        )
      })
    }
    if (printType !== 'All') {
      list = list.filter((inv) => {
        if (!inv.submissionId) return false
        const sub = submissionById.get(inv.submissionId)
        return sub?.data.printType.toLowerCase().includes(printType.toLowerCase())
      })
    }
    list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return list
  }, [invoices, submissionById, query, printType])

  if (firebaseDb && !firestoreReady) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Invoices</h1>
        <Card className="text-center py-12">
          <p className="text-slate-600">Loading invoices from Firebase…</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {firestoreError ? (
        <Card className="border-amber-200 bg-amber-50 py-3 text-sm text-amber-900">
          Firebase (invoices): {firestoreError}. Deploy Firestore rules (<code className="rounded bg-amber-100 px-1">firebase deploy
          --only firestore:rules</code>) and confirm the database exists.
        </Card>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Invoices</h1>
          <p className="mt-1 text-sm text-slate-600">
            {filtered.length} of {invoices.length} shown
            {firebaseDb ? ' — saved in Firestore.' : ' — stored only on this device.'}
          </p>
        </div>
        <Button to="/invoice">+ New invoice</Button>
      </div>

      <Card padding="sm" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor="inv-search" className="mb-1 block text-xs font-medium text-slate-500">
              Search
            </label>
            <Input
              id="inv-search"
              placeholder="Customer address, Order name, Job No, Owner, Fabric"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="inv-filter-print" className="mb-1 block text-xs font-medium text-slate-500">
              Print type
            </label>
            <Select id="inv-filter-print" value={printType} onChange={(e) => setPrintType(e.target.value)}>
              {PRINT_TYPE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="text-center">
          <p className="text-slate-600">
            {invoices.length === 0
              ? 'No invoices yet. Open an invoice from an order or create one with New invoice, then save.'
              : 'No matches for your filters.'}
          </p>
          {invoices.length === 0 ? (
            <div className="mt-4">
              <Button to="/invoice">New invoice</Button>
            </div>
          ) : null}
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((inv) => {
            const lines = cardLines(inv, submissionById)
            const linkedOrder = inv.submissionId ? submissionById.get(inv.submissionId) : undefined
            const dateLabel = formatDateDotDMY(inv.data.invoiceDate?.trim() || inv.createdAt.slice(0, 10))
            return (
              <li key={inv.id}>
                <Card padding="sm" className="transition hover:border-slate-300">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <Link to={`/invoice/${inv.id}`} className="min-w-0 flex-1 group">
                      <p className="font-medium text-slate-900 group-hover:text-blue-600">{lines.title}</p>
                      <p className="mt-1 truncate text-sm text-slate-500">{lines.subtitle}</p>
                      <p className="mt-1 truncate text-xs text-slate-400">
                        {lines.metaType} · Invoice {dateLabel} — updated {formatDateTimeDotDMY(inv.updatedAt)}
                      </p>
                    </Link>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button to={`/invoice/${inv.id}`} variant="secondary">
                        View
                      </Button>
                      {linkedOrder ? (
                        <Button to={`/submission/${inv.submissionId}/edit`} variant="secondary">
                          Edit
                        </Button>
                      ) : (
                        <Button variant="secondary" disabled>
                          Edit
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        onClick={() => {
                          if (!window.confirm('Delete this invoice? This cannot be undone.')) return
                          void deleteInvoice(inv.id).catch(() => {
                            window.alert('Could not delete. Check Firebase rules and your connection.')
                          })
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
