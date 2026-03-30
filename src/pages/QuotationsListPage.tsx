import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { getCurrentFinancialYearLabel, isWithinLastNDays } from '../lib/financialYear'
import { firebaseDb } from '../lib/firebase'
import { formatDateTimeDotDMY } from '../lib/dateDisplay'
import { useQuotationsStore } from '../store/useQuotationsStore'
import { useSubmissionsStore } from '../store/useSubmissionsStore'

const PRINT_TYPE_OPTIONS = ['All', 'Embroidery', 'Sublimation', 'Screen Print', 'Sticker']
export function QuotationsListPage() {
  const submissions = useSubmissionsStore((s) => s.submissions)
  const deleteSubmission = useSubmissionsStore((s) => s.deleteSubmission)
  const submissionsReady = useSubmissionsStore((s) => s.firestoreReady)
  const firestoreError = useSubmissionsStore((s) => s.firestoreError)
  const quotations = useQuotationsStore((s) => s.quotations)
  const quotationsReady = useQuotationsStore((s) => s.firestoreReady)
  const quotationsError = useQuotationsStore((s) => s.firestoreError)
  const [query, setQuery] = useState('')
  const [printType, setPrintType] = useState('All')
  const [timeFilter, setTimeFilter] = useState('all')
  const currentFinancialYear = useMemo(() => getCurrentFinancialYearLabel(), [])

  const quotationSubmissions = useMemo(() => {
    const byId = new Map(submissions.map((s) => [s.id, s] as const))
    return quotations
      .map((q) => {
        const linked = q.submissionId ? byId.get(q.submissionId) : undefined
        if (!linked && byId.has(q.id)) {
          return byId.get(q.id) ?? null
        }
        return linked ?? null
      })
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
  }, [quotations, submissions])

  const uniqueQuotationSubmissions = useMemo(() => {
    const seen = new Set<string>()
    return quotationSubmissions.filter((s) => {
      if (seen.has(s.id)) return false
      seen.add(s.id)
      return true
    })
  }, [quotationSubmissions])

  const financialYearOptions = useMemo(() => {
    const years = new Set<string>()
    for (const s of uniqueQuotationSubmissions) {
      if (s.financialYear?.trim()) years.add(s.financialYear)
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [uniqueQuotationSubmissions])

  const filtered = useMemo(() => {
    let list = uniqueQuotationSubmissions
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
    if (timeFilter === 'last7days') {
      list = list.filter((s) => isWithinLastNDays(s.createdAt, 7))
    } else if (timeFilter === 'previousFy') {
      list = list.filter((s) => s.financialYear !== currentFinancialYear)
    } else if (timeFilter.startsWith('fy:')) {
      const year = timeFilter.slice(3)
      list = list.filter((s) => s.financialYear === year)
    }
    return list
  }, [uniqueQuotationSubmissions, query, printType, timeFilter, currentFinancialYear])

  if (firebaseDb && (!submissionsReady || !quotationsReady)) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Quotations</h1>
        <Card className="text-center py-12">
          <p className="text-slate-600">Loading quotations from Firebase…</p>
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
      {quotationsError ? (
        <Card className="border-amber-200 bg-amber-50 py-3 text-sm text-amber-900">
          Quotations: {quotationsError}
        </Card>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Quotations</h1>
          <p className="mt-1 text-sm text-slate-600">
            {filtered.length} of {uniqueQuotationSubmissions.length} shown
            {firebaseDb ? ' — saved in Firestore.' : ' — stored only on this device.'}
          </p>
        </div>
        <Button to="/quotation">+ New quotation</Button>
      </div>

      <Card padding="sm" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="q-search" className="mb-1 block text-xs font-medium text-slate-500">
              Search
            </label>
            <Input
              id="q-search"
              placeholder="Order name, Job No, Owner, Fabric"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="q-filter-print" className="mb-1 block text-xs font-medium text-slate-500">
              Print type
            </label>
            <Select id="q-filter-print" value={printType} onChange={(e) => setPrintType(e.target.value)}>
              {PRINT_TYPE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="q-filter-time" className="mb-1 block text-xs font-medium text-slate-500">
              Time range
            </label>
            <Select id="q-filter-time" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
              <option value="all">All records</option>
              <option value="last7days">Last 7 days</option>
              <option value="previousFy">Previous financial years</option>
              <option value={`fy:${currentFinancialYear}`}>Current financial year ({currentFinancialYear})</option>
              {financialYearOptions
                .filter((year) => year !== currentFinancialYear)
                .map((year) => (
                  <option key={year} value={`fy:${year}`}>
                    Previous FY ({year})
                  </option>
                ))}
            </Select>
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="text-center">
          <p className="text-slate-600">
            {uniqueQuotationSubmissions.length === 0
              ? 'No saved quotations yet. Open a quotation and click Save quotation.'
              : 'No matches for your filters.'}
          </p>
          {uniqueQuotationSubmissions.length === 0 ? (
            <div className="mt-4">
              <Button to="/">Go to dashboard</Button>
            </div>
          ) : null}
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((s) => (
            <li key={s.id}>
              <Card padding="sm" className="transition hover:border-slate-300">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <Link to={`/quotation/${s.id}`} className="min-w-0 flex-1 group">
                    <p className="font-medium text-slate-900 group-hover:text-blue-600">{s.data.orderName}</p>
                    <p className="mt-1 truncate text-sm text-slate-500">
                      Job: {s.data.jobNo} - {s.data.ownerName}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-400">
                      {s.data.printType || 'No type'} — {formatDateTimeDotDMY(s.createdAt)}
                    </p>
                  </Link>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button to={`/quotation/${s.id}`} variant="secondary">
                      View
                    </Button>
                    <Button to={`/submission/${s.id}/edit`} variant="secondary">
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (!window.confirm('Delete this order? Its quotation will no longer be available here.')) return
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
