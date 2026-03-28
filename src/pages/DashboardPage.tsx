import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { firebaseDb } from '../lib/firebase'
import {
  buildMonthlyOrderSummaries,
  formatMoneyAmount,
  formatQuantityDisplay,
} from '../lib/monthlyOrderSummary'
import { useInvoicesStore } from '../store/useInvoicesStore'
import { useSubmissionsStore } from '../store/useSubmissionsStore'

const PRINT_TYPE_OPTIONS = ['All', 'Embroidery', 'Sublimation', 'Screen Print', 'Sticker']

export function DashboardPage() {
  const submissions = useSubmissionsStore((s) => s.submissions)
  const deleteSubmission = useSubmissionsStore((s) => s.deleteSubmission)
  const firestoreReady = useSubmissionsStore((s) => s.firestoreReady)
  const firestoreError = useSubmissionsStore((s) => s.firestoreError)
  const invoices = useInvoicesStore((s) => s.invoices)
  const invoicesReady = useInvoicesStore((s) => s.firestoreReady)
  const invoicesError = useInvoicesStore((s) => s.firestoreError)
  const [query, setQuery] = useState('')
  const [printType, setPrintType] = useState('All')
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null)

  const monthlySummaries = useMemo(
    () => buildMonthlyOrderSummaries(submissions, invoices),
    [submissions, invoices],
  )

  const selectedMonth = useMemo(
    () => monthlySummaries.find((m) => m.key === selectedMonthKey) ?? null,
    [monthlySummaries, selectedMonthKey],
  )

  const filtered = useMemo(() => {
    let list = submissions
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (s) =>
          s.data.orderName.toLowerCase().includes(q) ||
          s.data.jobNo.toLowerCase().includes(q) ||
          s.data.ownerName.toLowerCase().includes(q) ||
          s.data.fabric.toLowerCase().includes(q),
      )
    }
    if (printType !== 'All') {
      list = list.filter((s) => s.data.printType.toLowerCase().includes(printType.toLowerCase()))
    }
    return list
  }, [submissions, query, printType])

  if (firebaseDb && (!firestoreReady || !invoicesReady)) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Orders</h1>
        <Card className="text-center py-12">
          <p className="text-slate-600">Loading orders and invoices from Firebase…</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {firestoreError ? (
        <Card className="border-amber-200 bg-amber-50 py-3 text-sm text-amber-900">
          Firebase: {firestoreError}. Deploy Firestore rules (<code className="rounded bg-amber-100 px-1">firebase deploy
          --only firestore:rules</code>) and confirm the database exists.
        </Card>
      ) : null}
      {invoicesError ? (
        <Card className="border-amber-200 bg-amber-50 py-3 text-sm text-amber-900">
          Invoices: {invoicesError}
        </Card>
      ) : null}

      {monthlySummaries.length > 0 ? (
        <section className="space-y-3" aria-label="Monthly banner and flag quantity summary">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Monthly summary</h2>
            <p className="mt-1 text-sm text-slate-600">
              <strong>Banner / flag qty</strong> uses the month the <strong>order was created</strong> (qty from the
              invoice when saved, else the order form). <strong>Invoice totals</strong> when you click a month use the
              invoice’s <strong>Date</strong> field (same month as on the printed invoice), so they match your paperwork
              even if the order was created earlier.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {monthlySummaries.map((row) => {
              const isSelected = selectedMonthKey === row.key
              return (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => setSelectedMonthKey(isSelected ? null : row.key)}
                  className={`rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow ${
                    isSelected ? 'border-blue-500 ring-2 ring-blue-500 ring-offset-2' : 'border-slate-200'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                  <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-800">
                    <span className="text-blue-700">{formatQuantityDisplay(row.bannerQuantity)}</span>
                    <span className="mx-1 text-sm font-normal text-slate-500">banner qty</span>
                    <span className="text-slate-300">·</span>
                    <span className="ml-1 text-emerald-700">{formatQuantityDisplay(row.flagQuantity)}</span>
                    <span className="ml-1 text-sm font-normal text-slate-500">flag qty</span>
                  </p>
                  {row.otherQuantity > 0 ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Other types: {formatQuantityDisplay(row.otherQuantity)} qty
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs text-slate-500">
                    {isSelected ? 'Click again to hide total' : 'Click for invoice total'}
                  </p>
                </button>
              )
            })}
          </div>
          {selectedMonth ? (
            <Card className="border-blue-100 bg-blue-50/60 py-4">
              <p className="text-sm font-medium text-slate-700">{selectedMonth.label}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">Invoice total (sum)</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {formatMoneyAmount(selectedMonth.invoiceGrossTotal)}
              </p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Balance due (sum)
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-800">
                {formatMoneyAmount(selectedMonth.invoiceBalanceTotal)}
              </p>
              <p className="mt-3 text-xs text-slate-600">
                Includes every saved invoice whose <strong>invoice date</strong> falls in {selectedMonth.label}.{' '}
                <strong>Total</strong> sums each invoice’s line amounts (qty × unit price). <strong>Balance</strong>{' '}
                uses advance the same way as on the invoice. Standalone invoices (not tied to an order) are included
                too.
              </p>
            </Card>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Orders</h1>
          <p className="mt-1 text-sm text-slate-600">
            {filtered.length} of {submissions.length} shown
            {firebaseDb ? ' — saved in Firestore.' : ' — stored only on this device.'}
          </p>
        </div>
        <Button to="/survey">New order</Button>
      </div>

      <Card padding="sm" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor="search" className="mb-1 block text-xs font-medium text-slate-500">
              Search
            </label>
            <Input
              id="search"
              placeholder="Order name, Job No, Owner, Fabric"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="filter-print" className="mb-1 block text-xs font-medium text-slate-500">
              Print type
            </label>
            <Select id="filter-print" value={printType} onChange={(e) => setPrintType(e.target.value)}>
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
            {submissions.length === 0
              ? 'No orders yet. Create one to see it here.'
              : 'No matches for your filters.'}
          </p>
          {submissions.length === 0 ? (
            <div className="mt-4">
              <Button to="/survey">Create order</Button>
            </div>
          ) : null}
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((s) => (
            <li key={s.id}>
              <Card padding="sm" className="transition hover:border-slate-300">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <Link to={`/submission/${s.id}`} className="min-w-0 flex-1 group">
                    <p className="font-medium text-slate-900 group-hover:text-blue-600">{s.data.orderName}</p>
                    <p className="mt-1 truncate text-sm text-slate-500">
                      Job: {s.data.jobNo} - {s.data.ownerName}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-400">
                      {s.data.printType || 'No type'} - {new Date(s.createdAt).toLocaleString()}
                    </p>
                  </Link>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button to={`/submission/${s.id}`} variant="secondary">
                      View
                    </Button>
                    <Button to={`/submission/${s.id}/edit`} variant="secondary">
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (!window.confirm('Delete this order? This cannot be undone.')) return
                        void deleteSubmission(s.id).catch(() => {
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
          ))}
        </ul>
      )}
    </div>
  )
}

