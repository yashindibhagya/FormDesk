import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { firebaseDb } from '../lib/firebase'
import { getCurrentFinancialYearLabel, isWithinLastNDays } from '../lib/financialYear'
import {
  buildMonthlyOrderSummaries,
  formatMoneyAmount,
  formatQuantityDisplay,
} from '../lib/monthlyOrderSummary'
import { useInvoicesStore } from '../store/useInvoicesStore'
import { formatDateTimeDotDMY } from '../lib/dateDisplay'
import { useSubmissionsStore } from '../store/useSubmissionsStore'

const PRINT_TYPE_OPTIONS = ['All', 'Banner', 'Flag']
const TIME_FILTER_OPTIONS = ['all', 'last7days', 'previousFy'] as const

function classifyPrintType(raw: string): 'banner' | 'flag' | 'other' {
  const value = raw.trim().toLowerCase()
  if (value.includes('banner')) return 'banner'
  if (value.includes('flag')) return 'flag'
  return 'other'
}

export function DashboardPage() {
  const [searchParams] = useSearchParams()
  const submissions = useSubmissionsStore((s) => s.submissions)
  const deleteSubmission = useSubmissionsStore((s) => s.deleteSubmission)
  const firestoreReady = useSubmissionsStore((s) => s.firestoreReady)
  const firestoreError = useSubmissionsStore((s) => s.firestoreError)
  const invoices = useInvoicesStore((s) => s.invoices)
  const invoicesReady = useInvoicesStore((s) => s.firestoreReady)
  const invoicesError = useInvoicesStore((s) => s.firestoreError)
  const [query, setQuery] = useState('')
  const [printType, setPrintType] = useState('All')
  const [timeFilter, setTimeFilter] = useState('all')
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null)
  const [hoveredChartPointKey, setHoveredChartPointKey] = useState<string | null>(null)
  const currentFinancialYear = useMemo(() => getCurrentFinancialYearLabel(), [])
  const ordersOnly = searchParams.get('ordersOnly') === '1'
  const financialYearOptions = useMemo(() => {
    const years = new Set<string>()
    for (const s of submissions) {
      if (s.financialYear?.trim()) years.add(s.financialYear)
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [submissions])

  const monthlySummaries = useMemo(
    () => buildMonthlyOrderSummaries(submissions, invoices),
    [submissions, invoices],
  )

  const selectedMonth = useMemo(
    () => monthlySummaries.find((m) => m.key === selectedMonthKey) ?? null,
    [monthlySummaries, selectedMonthKey],
  )

  useEffect(() => {
    const next = (searchParams.get('time') ?? '').trim()
    if (!next) return
    if (next === 'currentFy') {
      setTimeFilter(`fy:${currentFinancialYear}`)
      return
    }
    if (TIME_FILTER_OPTIONS.includes(next as (typeof TIME_FILTER_OPTIONS)[number])) {
      setTimeFilter(next)
      return
    }
    if (next.startsWith('fy:')) {
      setTimeFilter(next)
    }
  }, [searchParams, currentFinancialYear])

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
      const wanted = printType.toLowerCase()
      list = list.filter((s) => classifyPrintType(s.data.printType) === wanted)
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
  }, [submissions, query, printType, timeFilter, currentFinancialYear])

  const ordersCountChart = useMemo(() => {
    const fmtKey = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit' })
    const fmtLabel = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })
    const now = new Date()
    const monthStarts: Date[] = []
    for (let i = 11; i >= 0; i -= 1) {
      monthStarts.push(new Date(now.getFullYear(), now.getMonth() - i, 1))
    }
    const seed = new Map<string, number>()
    for (const d of monthStarts) seed.set(fmtKey.format(d), 0)

    for (const s of filtered) {
      const t = Date.parse(s.createdAt)
      if (Number.isNaN(t)) continue
      const key = fmtKey.format(new Date(t))
      if (!seed.has(key)) continue
      seed.set(key, (seed.get(key) ?? 0) + 1)
    }

    const points = monthStarts.map((d) => {
      const key = fmtKey.format(d)
      return {
        key,
        label: fmtLabel.format(d),
        shortLabel: d.toLocaleString('en-US', { month: 'short' }),
        count: seed.get(key) ?? 0,
      }
    })
    const max = Math.max(1, ...points.map((p) => p.count))
    return { points, max }
  }, [filtered])

  const hoveredChartPoint = useMemo(
    () => ordersCountChart.points.find((p) => p.key === hoveredChartPointKey) ?? null,
    [ordersCountChart.points, hoveredChartPointKey],
  )

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

      {!ordersOnly && monthlySummaries.length > 0 ? (
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
                  className={`rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow ${isSelected ? 'border-blue-500 ring-2 ring-blue-500 ring-offset-2' : 'border-slate-200'
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

      {!ordersOnly ? (
        <Card padding="sm">
          <div className="mb-3 flex items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Orders count chart</h2>
              <p className="text-xs text-slate-500">Last 12 months (based on current filters)</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <svg
              viewBox="0 0 720 220"
              className="h-52 w-full min-w-[38rem]"
              role="img"
              aria-label="Orders count XY chart for the last 12 months"
            >
              {[0, 1, 2, 3, 4].map((tick) => {
                const x1 = 48
                const x2 = 700
                const y = 20 + (tick * 160) / 4
                const tickValue = Math.round(ordersCountChart.max - (tick * ordersCountChart.max) / 4)
                return (
                  <g key={tick}>
                    <line x1={x1} y1={y} x2={x2} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                    <text x="40" y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">
                      {tickValue}
                    </text>
                  </g>
                )
              })}

              <line x1="48" y1="180" x2="700" y2="180" stroke="#94a3b8" strokeWidth="1.5" />
              <line x1="48" y1="20" x2="48" y2="180" stroke="#94a3b8" strokeWidth="1.5" />

              <polyline
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={ordersCountChart.points
                  .map((p, idx) => {
                    const x = 48 + (idx * 652) / Math.max(1, ordersCountChart.points.length - 1)
                    const y = 20 + (1 - p.count / ordersCountChart.max) * 160
                    return `${x},${y}`
                  })
                  .join(' ')}
              />

              {ordersCountChart.points.map((p, idx) => {
                const x = 48 + (idx * 652) / Math.max(1, ordersCountChart.points.length - 1)
                const y = 20 + (1 - p.count / ordersCountChart.max) * 160
                const isHovered = hoveredChartPointKey === p.key
                return (
                  <g key={p.key}>
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 7 : 5}
                      fill={isHovered ? '#1d4ed8' : '#3b82f6'}
                      stroke="#ffffff"
                      strokeWidth="2"
                      onMouseEnter={() => setHoveredChartPointKey(p.key)}
                      onMouseLeave={() => setHoveredChartPointKey(null)}
                      onFocus={() => setHoveredChartPointKey(p.key)}
                      onBlur={() => setHoveredChartPointKey(null)}
                    >
                      <title>
                        {p.label}: {p.count} orders
                      </title>
                    </circle>
                    <text x={x} y="198" textAnchor="middle" fontSize="11" fill="#64748b">
                      {p.shortLabel}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
          <div className="mt-2 min-h-5 text-xs text-slate-600">
            {hoveredChartPoint
              ? `${hoveredChartPoint.label}: ${hoveredChartPoint.count} total orders`
              : 'Hover any point to see the month and total order count'}
          </div>
        </Card>
      ) : null}

      {/* <Card padding="sm" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-2">
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
          <div>
            <label htmlFor="filter-time" className="mb-1 block text-xs font-medium text-slate-500">
              Time range
            </label>
            <Select id="filter-time" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
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
      </Card> */}

      {filtered.length === 0 && submissions.length === 0 ? (
        <Card className="text-center">
          <p className="text-slate-600">No orders yet. Create one to see it here.</p>
          <div className="mt-4">
            <Button to="/survey">Create order</Button>
          </div>
        </Card>
      ) : null}
    </div>
  )
}

