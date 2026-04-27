import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import logoMawp from '../../assets/logo 1.jpg'
import { formatDateDotDMY, formatDateTimeDotDMY } from '../../lib/dateDisplay'
import type { Submission } from '../../types/survey'
import { Card } from '../ui/Card'

type Props = {
  submission: Submission
  onConfirm?: () => void
  onRequestChanges?: () => void
}

function getFirstNumericValue(raw: string): number | null {
  const match = raw.match(/(\d+(?:\.\d+)?)/)
  if (!match) return null
  const parsed = Number.parseFloat(match[1])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function getSewingLayout(widthRaw: string, heightRaw: string): {
  aspectRatio: number
  maxWidthPx?: number
} {
  const width = getFirstNumericValue(widthRaw)
  const height = getFirstNumericValue(heightRaw)
  if (!width || !height) return { aspectRatio: 16 / 9 }
  if (height > width) {
    // Keep portrait sewing diagrams tighter so print/PDF stays on one page.
    return { aspectRatio: 2 / 3, maxWidthPx: 210 }
  }
  const landscapeRatio = width / height
  return { aspectRatio: Math.min(Math.max(landscapeRatio, 1), 12 / 5) }
}

/** Sewing corner bands: append " pocket" for display (red in UI). Skip if value already ends with "pocket". */
function sewCornerPocketDisplay(raw: string | undefined): string {
  const t = raw?.trim() ?? ''
  if (!t) return ''
  if (/pocket$/i.test(t)) return t
  return `${t} (pocket)`
}

const MAX_SEW_SIDE_MARKERS = 30

function parseMarkerCount(raw: string | undefined): number {
  const n = Number.parseInt((raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(n, MAX_SEW_SIDE_MARKERS)
}

function markerPositions(count: number): number[] {
  if (count <= 0) return []
  if (count === 1) return [0]
  return Array.from({ length: count }, (_, idx) => (idx / (count - 1)) * 100)
}

export type SubmissionPrintDocumentShellProps = {
  submission: Submission
  /** For screenshot PDF / copy-image capture on the submission detail page */
  printRef?: RefObject<HTMLDivElement | null>
  /**
   * Survey form: render the same Card + frame as the saved submission view, but
   * parked off-screen until the user prints (then @media print shows it).
   */
  hiddenOffScreen?: boolean
}

/**
 * Same outer layout as the saved submission on the dashboard: `Card` + inner
 * `max-w-6xl` panel. Use everywhere the document should match that screen design
 * (print/PDF, wizard preview, screenshot export).
 */
export function SubmissionPrintDocumentShell({
  submission,
  printRef,
  hiddenOffScreen = false,
}: SubmissionPrintDocumentShellProps) {
  const framed = (
    <Card className="print:border-0 print:bg-transparent print:p-0 print:shadow-none">
      <div
        ref={printRef}
        className="print-document mx-auto w-full max-w-6xl rounded-xl border border-slate-100 bg-slate-50 p-4 sm:p-6 print:border-0"
      >
        <SubmissionPrintView submission={submission} />
      </div>
    </Card>
  )

  if (!hiddenOffScreen) return framed

  return (
    <div className="print-portal-host" aria-hidden="true">
      {framed}
    </div>
  )
}

export function SubmissionPrintView({ submission, onConfirm, onRequestChanges }: Props) {
  const { data } = submission
  const created = formatDateTimeDotDMY(submission.createdAt)
  const sewingLayout = getSewingLayout(data.sizeWidth || '', data.sizeHeight || '')
  const leftMarkerPositions = markerPositions(parseMarkerCount(data.sewCornerTopLeftText))
  const rightMarkerPositions = markerPositions(parseMarkerCount(data.sewCornerTopRightText))
  const designPreviewItems = [
    { src: data.designImage, qty: data.designImageQty },
    { src: data.designThumb1, qty: data.designThumb1Qty },
    { src: data.designThumb2, qty: data.designThumb2Qty },
    { src: data.designThumb3, qty: data.designThumb3Qty },
  ].filter(
    (item): item is { src: string; qty: string } =>
      typeof item.src === 'string' && item.src.trim().length > 0,
  )
  const hasAnyImage = designPreviewItems.length > 0

  const fabricBodyRowRef = useRef<HTMLDivElement>(null)
  const [fabricBodyHeightPx, setFabricBodyHeightPx] = useState(0)
  const sideSewStripRef = useRef<HTMLDivElement>(null)
  const [sideSewStripHeightPx, setSideSewStripHeightPx] = useState(0)

  useLayoutEffect(() => {
    if (!data.sewYes) {
      setFabricBodyHeightPx(0)
      return
    }
    const el = fabricBodyRowRef.current
    if (!el) return
    const update = () => {
      setFabricBodyHeightPx(Math.max(32, Math.round(el.getBoundingClientRect().height)))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [data.sewYes, sewingLayout.aspectRatio, sewingLayout.maxWidthPx, data.sizeWidth, data.sizeHeight])

  useLayoutEffect(() => {
    if (!data.sewYes || (!data.sewCornerLeftText?.trim() && !data.sewCornerRightText?.trim())) {
      setSideSewStripHeightPx(0)
      return
    }
    const el = sideSewStripRef.current
    if (!el) return
    const update = () => {
      setSideSewStripHeightPx(Math.max(32, Math.round(el.getBoundingClientRect().height)))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [
    data.sewYes,
    data.sewCornerLeftText,
    data.sewCornerRightText,
    data.sewCornerTopText,
    data.sewCornerBottomText,
    sewingLayout.aspectRatio,
    sewingLayout.maxWidthPx,
  ])

  const sewEdgeBandPct = 12
  const sewInsetTopPct = data.sewCornerTopText?.trim() ? sewEdgeBandPct : 5
  const sewInsetBottomPct = data.sewCornerBottomText?.trim() ? sewEdgeBandPct : 5
  const sewDiagramInsetStyle = {
    left: `${sewEdgeBandPct}%`,
    right: `${sewEdgeBandPct}%`,
    top: `${sewInsetTopPct}%`,
    bottom: `${sewInsetBottomPct}%`,
  } as const
  const sewSideStripStyle = {
    top: `${sewInsetTopPct}%`,
    bottom: `${sewInsetBottomPct}%`,
  } as const

  return (
    <div className="font-sans text-slate-900 px-0 py-4 sm:py-6 print:py-0">

      {/* ── Header (matches reference: navy title, date top-right) ── */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3 mb-4 print:pb-3 print:mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={logoMawp}
            alt="MAWP"
            className="h-9 w-9 shrink-0 rounded-lg object-contain"
          />
          <div className="min-w-0">
            <p className="text-base font-semibold leading-tight text-[#042C53]">MAWPrinting Orders</p>
            <p className="text-xs text-slate-500 mt-1">Order confirmation &amp; review</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] tabular-nums text-slate-400">{created}</p>
        </div>
      </div>

      {/* ── Greeting (screen only — omitted from PDF to match reference layout) ── */}
      {data.ownerName && (
        <div className="mb-5 rounded-r-lg border border-slate-200 border-l-[3px] border-l-blue-600 bg-white py-3 pl-4 pr-4 shadow-sm print:hidden">
          <p className="text-sm text-slate-600 leading-relaxed">
            Hello <span className="font-medium text-slate-900">{data.ownerName}</span>, please review your order
            details below and confirm everything looks correct before we begin production. If anything
            needs adjusting, let us know.
          </p>
        </div>
      )}

      {/* ── Main grid: row1 customer+schedule | print; row2 sewing | design (same row = aligned bottoms) ── */}
      <div className="order-layout-grid grid grid-cols-1 gap-4 items-stretch">

        {/* Row 1 col 1 — Customer & schedule */}
        <div className="flex min-h-0 flex-col space-y-3">
          <SectionLabel>Customer &amp; job</SectionLabel>
          <InfoCard>
            <Field label="Job no" value={data.jobNo || '—'} />
            <Field label="Order name" value={data.orderName || '—'} />
            <Field label="Owner" value={data.ownerName || '—'} />
            <Field label="NIC" value={data.nic || '—'} />
            <Field label="Address" value={data.address || '—'} />
          </InfoCard>

          <SectionLabel>Schedule</SectionLabel>
          <InfoCard>
            <Field label="Order date" value={formatDateDotDMY(data.orderDate) || '—'} />
            <div className="pt-2 first:pt-0">
              <p className="text-[11px] text-slate-400 mb-1">Delivered by</p>
              {data.deliveredBy ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  {formatDateDotDMY(data.deliveredBy)}
                </span>
              ) : (
                <span className="text-sm text-slate-700">—</span>
              )}
            </div>
          </InfoCard>
        </div>

        {/* Row 1 col 2 — Print */}
        <div className="flex min-h-0 flex-col space-y-3">
          <SectionLabel>Print specifications</SectionLabel>
          <SpecCard title="Print" className="min-h-0 flex-1">
            <SpecRow label="Fabric" value={data.fabric || '—'} />
            {data.printType === 'Banner' ? (
              <div className="flex items-center gap-2 border-b border-slate-100 py-2 last:border-b-0">
                <span className="w-24 shrink-0 text-xs text-slate-500">Quantity</span>
                <div className="grid flex-1 grid-cols-3 gap-2">
                  <span className="flex min-h-[30px] items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-[#042C53]">
                    Normal: {data.quantityNormal || '—'}
                  </span>
                  <span className="flex min-h-[30px] items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-[#042C53]">
                    Left: {data.quantityLeft || '—'}
                  </span>
                  <span className="flex min-h-[30px] items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-[#042C53]">
                    Right: {data.quantityRight || '—'}
                  </span>
                </div>
              </div>
            ) : (
              <SpecRow label="Quantity" value={data.quantity || '—'} />
            )}
            <div className="flex items-center gap-2 border-b border-slate-100 py-2 last:border-b-0">
              <span className="w-24 shrink-0 text-xs text-slate-500">Size</span>
              <div className="flex flex-1 gap-2">
                <span className="flex min-h-[30px] flex-1 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-[#042C53]">
                  H: {data.sizeHeight || '—'}
                </span>
                <span className="flex min-h-[30px] flex-1 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-[#042C53]">
                  W: {data.sizeWidth || '—'}
                </span>
              </div>
            </div>
            <SpecRow label="Method" value={data.method || '—'} />
            <SpecRow label="Type" value={data.printType || '—'} />
            <SpecRow label="Description" value={data.printDescription || '—'} />
          </SpecCard>
        </div>

        {/* Row 2 col 1 — Sewing (stretches with design column) */}
        <div className="flex min-h-0 flex-col space-y-3">
          <SectionLabel>Sewing</SectionLabel>
          <SpecCard title="Sewing instructions" className="min-h-0 flex-1">
            {data.sewYes ? (
              <>
                <div className="mb-2 flex items-center gap-2 print:mb-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2,5 4.5,7.5 8,3" />
                    </svg>
                    Sewing required
                  </span>
                </div>
                <div className="flex flex-1 flex-col rounded-lg bg-slate-50 px-2 py-1.5 print:px-1.5 print:py-1">
                  <div
                    className="relative mx-auto w-full max-w-[240px] print:max-w-[240px]"
                    style={{
                      aspectRatio: sewingLayout.aspectRatio,
                      maxWidth: sewingLayout.maxWidthPx ? `${sewingLayout.maxWidthPx}px` : undefined,
                    }}
                  >
                    <div
                      className="absolute flex min-h-0 flex-col overflow-hidden border border-slate-300 bg-slate-300"
                      style={sewDiagramInsetStyle}
                    >
                      <div className="flex w-full min-w-0 shrink-0 items-center gap-1.5 px-1.5 py-1">
                        <div className="flex min-h-px min-w-10 flex-1 basis-0 items-center sm:min-w-16">
                          <span className="h-px w-full bg-slate-600" />
                        </div>
                        {data.sizeWidth?.trim() ? (
                          <span className="shrink-0 whitespace-nowrap text-[9px] font-semibold tabular-nums text-slate-800">
                            W: {data.sizeWidth.trim()}
                          </span>
                        ) : (
                          <span className="shrink-0 whitespace-nowrap text-[9px] font-medium text-slate-500">
                            Width
                          </span>
                        )}
                        <div className="flex min-h-px min-w-10 flex-1 basis-0 items-center sm:min-w-16">
                          <span className="h-px w-full bg-slate-600" />
                        </div>
                      </div>
                      <div ref={fabricBodyRowRef} className="flex min-h-0 min-w-0 flex-1 flex-row">
                        <div className="flex h-full w-10 shrink-0 items-center justify-center overflow-visible">
                          <div
                            className="flex origin-center -rotate-90 flex-row items-center gap-1 whitespace-nowrap"
                            style={{
                              width: fabricBodyHeightPx > 0 ? `${fabricBodyHeightPx}px` : '7rem',
                            }}
                          >
                            <div className="flex min-h-px min-w-10 flex-1 basis-0 items-center sm:min-w-16">
                              <span className="h-px w-full bg-slate-600" />
                            </div>
                            {data.sizeHeight?.trim() ? (
                              <span className="shrink-0 text-[9px] font-semibold tabular-nums text-slate-800">
                                H: {data.sizeHeight.trim()}
                              </span>
                            ) : (
                              <span className="shrink-0 text-[9px] font-medium text-slate-500">Height</span>
                            )}
                            <div className="flex min-h-px min-w-10 flex-1 basis-0 items-center sm:min-w-16">
                              <span className="h-px w-full bg-slate-600" />
                            </div>
                          </div>
                        </div>
                        <div className="min-h-0 min-w-0 flex-1 bg-slate-300" aria-hidden />
                      </div>
                    </div>
                    <div className="pointer-events-none absolute z-20" style={sewDiagramInsetStyle}>
                      {leftMarkerPositions.map((top, idx) => (
                        <span
                          key={`left-marker-${idx}`}
                          className="absolute left-0 -translate-x-full -translate-y-1/2 pr-1.5 text-base font-extrabold leading-none text-slate-700"
                          style={{ top: `${top}%` }}
                          aria-hidden
                        >
                          {'>'}
                        </span>
                      ))}
                      {rightMarkerPositions.map((top, idx) => (
                        <span
                          key={`right-marker-${idx}`}
                          className="absolute right-0 translate-x-full -translate-y-1/2 pl-1.5 text-base font-extrabold leading-none text-slate-700"
                          style={{ top: `${top}%` }}
                          aria-hidden
                        >
                          {'<'}
                        </span>
                      ))}
                    </div>

                    {data.sewCornerTopText?.trim() ? (
                      <div
                        className="absolute top-0 flex items-stretch justify-center gap-2 border border-slate-400 bg-white px-2 py-2"
                        style={{ left: `${sewEdgeBandPct}%`, right: `${sewEdgeBandPct}%`, height: `${sewEdgeBandPct}%` }}
                      >
                        <span className="w-px shrink-0 self-stretch bg-slate-300" />
                        <span className="flex items-center text-xs font-medium leading-none text-red-600">
                          {sewCornerPocketDisplay(data.sewCornerTopText)}
                        </span>
                        <span className="w-px shrink-0 self-stretch bg-slate-300" />
                      </div>
                    ) : null}

                    {data.sewCornerLeftText?.trim() ? (
                      <div
                        ref={sideSewStripRef}
                        className="absolute left-0 flex items-center justify-center overflow-visible border border-slate-400 bg-white px-0 py-0"
                        style={{ ...sewSideStripStyle, width: `${sewEdgeBandPct}%` }}
                      >
                        <div
                          className="flex origin-center -rotate-90 flex-row items-center gap-1 whitespace-nowrap"
                          style={{
                            width:
                              sideSewStripHeightPx > 0
                                ? `${sideSewStripHeightPx}px`
                                : fabricBodyHeightPx > 0
                                  ? `${fabricBodyHeightPx}px`
                                  : '6rem',
                          }}
                        >
                          <div className="flex min-h-px min-w-6 flex-1 basis-0 items-center sm:min-w-8">
                            <span className="h-px w-full bg-slate-300" />
                          </div>
                          <span className="shrink-0 text-[9px] font-medium leading-none text-red-600">
                            {sewCornerPocketDisplay(data.sewCornerLeftText)}
                          </span>
                          <div className="flex min-h-px min-w-6 flex-1 basis-0 items-center sm:min-w-8">
                            <span className="h-px w-full bg-slate-300" />
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {data.sewCornerRightText?.trim() ? (
                      <div
                        ref={data.sewCornerLeftText?.trim() ? undefined : sideSewStripRef}
                        className="absolute right-0 flex items-center justify-center overflow-visible border border-slate-400 bg-white px-0 py-0"
                        style={{ ...sewSideStripStyle, width: `${sewEdgeBandPct}%` }}
                      >
                        <div
                          className="flex origin-center rotate-90 flex-row items-center gap-1 whitespace-nowrap"
                          style={{
                            width:
                              sideSewStripHeightPx > 0
                                ? `${sideSewStripHeightPx}px`
                                : fabricBodyHeightPx > 0
                                  ? `${fabricBodyHeightPx}px`
                                  : '6rem',
                          }}
                        >
                          <div className="flex min-h-px min-w-6 flex-1 basis-0 items-center sm:min-w-8">
                            <span className="h-px w-full bg-slate-300" />
                          </div>
                          <span className="shrink-0 text-[9px] font-medium leading-none text-red-600">
                            {sewCornerPocketDisplay(data.sewCornerRightText)}
                          </span>
                          <div className="flex min-h-px min-w-6 flex-1 basis-0 items-center sm:min-w-8">
                            <span className="h-px w-full bg-slate-300" />
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {data.sewCornerBottomText?.trim() ? (
                      <div
                        className="absolute bottom-0 flex items-stretch justify-center gap-2 border border-slate-400 bg-white px-2 py-2"
                        style={{ left: `${sewEdgeBandPct}%`, right: `${sewEdgeBandPct}%`, height: `${sewEdgeBandPct}%` }}
                      >
                        <span className="w-px shrink-0 self-stretch bg-slate-300" />
                        <span className="flex items-center text-xs font-medium leading-none text-red-600">
                          {sewCornerPocketDisplay(data.sewCornerBottomText)}
                        </span>
                        <span className="w-px shrink-0 self-stretch bg-slate-300" />
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                  No sewing required
                </span>
              </div>
            )}
          </SpecCard>
        </div>

        {/* Row 2 col 2 — Design previews (same row as sewing = shared bottom edge) */}
        <div className="flex min-h-0 flex-col space-y-3">
          {hasAnyImage ? (
            <>
              <SectionLabel>Design previews</SectionLabel>
              <InfoCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div
                  className={`grid min-h-0 flex-1 gap-2 auto-rows-fr ${designPreviewItems.length >= 2 ? 'grid-cols-2' : 'grid-cols-1'}`}
                >
                  {designPreviewItems.map((item, idx) => (
                    <div
                      key={`preview-${idx}`}
                      className="relative flex aspect-square min-h-0 w-full min-w-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50 p-1"
                    >
                      {item.qty?.trim() ? (
                        <span className="pointer-events-none absolute left-1 top-1 z-10 max-w-[calc(100%-0.5rem)] truncate rounded bg-slate-900/85 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white shadow-sm">
                          Qty {item.qty.trim()}
                        </span>
                      ) : null}
                      <img
                        src={item.src}
                        alt={`Design ${idx + 1}`}
                        className="max-h-full max-w-full object-contain object-center"
                      />
                    </div>
                  ))}
                </div>
              </InfoCard>
            </>
          ) : (
            <div className="min-h-0" aria-hidden />
          )}
        </div>

        {/* Delivery — full width */}
        {data.deliveryNotes?.trim() ? (
          <div className="col-span-full space-y-3">
            <SectionLabel>Delivery notes</SectionLabel>
            <SpecCard title="Notes">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-lg p-3 border border-slate-100">
                {data.deliveryNotes}
              </p>
            </SpecCard>
          </div>
        ) : null}
      </div>

      {/* ── Confirmation bar (only when embedded in a flow that supplies actions) ── */}
      {onConfirm != null || onRequestChanges != null ? (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-slate-900">Does everything look correct?</p>
            <p className="text-xs text-slate-400 mt-0.5">Your confirmation starts production. Reply if anything needs adjusting.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRequestChanges}
              className="text-sm font-medium px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Request changes
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-[#185FA5] hover:bg-[#0C447C] text-white border-0 transition-colors"
            >
              Confirm order
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 px-0.5">
      {children}
    </p>
  )
}

function InfoCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-0 ${className}`}
    >
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
      <p className="text-[11px] text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-medium text-[#042C53] whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function SpecCard({
  title,
  children,
  className = '',
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm ${className}`}
    >
      <div className="mb-3 flex shrink-0 items-center justify-between border-b border-slate-100 pb-2.5">
        <h3 className="text-sm font-semibold text-[#042C53]">{title}</h3>
        <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#185FA5]">
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="#B5D4F4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2,5 4.5,7.5 8,3" />
          </svg>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-0">{children}</div>
    </div>
  )
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 py-2 last:border-b-0">
      <span className="w-24 shrink-0 text-xs text-slate-500">{label}</span>
      <span className="flex min-h-[30px] flex-1 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-[#042C53] whitespace-pre-wrap">
        {value}
      </span>
    </div>
  )
}