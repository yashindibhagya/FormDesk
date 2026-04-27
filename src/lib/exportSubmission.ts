import { toCanvas } from 'html-to-image'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { formatDateDotDMY, formatDateTimeDotDMY } from './dateDisplay'
import type { Submission } from '../types/survey'

/**
 * html2canvas cannot parse oklch() / oklab() / color-mix(in oklab …) used by
 * Tailwind v4. We resolve these at three levels:
 *
 *  1. patchClonedDocStylesheets – rewrites <style> text and replaces same-origin
 *     <link> sheets with inlined+patched copies BEFORE html2canvas parses CSS.
 *     This stops the throw that occurs in the parser phase.
 *
 *  2. applyResolvedColorsToClone – walks the cloned element tree and inlines every
 *     computed colour as rgb/rgba so the fallback is consistent even if a sheet
 *     couldn't be patched (e.g. cross-origin).
 */

// Reuse one canvas context across all colour normalisation calls.
let _colorCtx: CanvasRenderingContext2D | null = null
function normalizeCssColor(value: string): string {
  if (!value) return value
  if (!_colorCtx) _colorCtx = document.createElement('canvas').getContext('2d')
  const ctx = _colorCtx
  if (!ctx) return value
  ctx.fillStyle = '#000000'
  try {
    ctx.fillStyle = value
    return ctx.fillStyle
  } catch {
    return value
  }
}

function hasModernColorSyntax(css: string): boolean {
  return css.includes('oklch(') || css.includes('oklab(') || css.includes('color-mix(')
}

/**
 * Replace oklch(…), oklab(…), and color-mix(in ok…) occurrences in raw CSS text
 * with browser-resolved rgb values via the canvas fillStyle trick.
 */
function replaceModernColorSyntax(css: string): string {
  // Replace inner oklch / oklab first (they may appear inside color-mix).
  let result = css
    .replace(/oklch\([^)]+\)/g, (m) => normalizeCssColor(m))
    .replace(/oklab\([^)]+\)/g, (m) => normalizeCssColor(m))

  // After inner replacements, attempt to resolve any remaining color-mix() that
  // used oklab/oklch as the interpolation colour space.  The regex avoids
  // matching beyond the balanced closing paren by stopping at the first ')' that
  // follows a digit/% (good enough for Tailwind's generated output).
  result = result.replace(
    /color-mix\(in\s+ok\w+[^)]+\)/g,
    (m) => normalizeCssColor(m),
  )

  return result
}

/**
 * Temporarily patch every <style> element in the LIVE document so that when
 * html2canvas clones the document it receives already-patched styles.
 * Returns a restore function – call it after html2canvas finishes.
 */
function patchLiveStylesAndGetRestorer(): () => void {
  const originals = new Map<HTMLStyleElement, string>()
  for (const el of Array.from(document.querySelectorAll<HTMLStyleElement>('style'))) {
    const raw = el.textContent ?? ''
    if (hasModernColorSyntax(raw)) {
      originals.set(el, raw)
      el.textContent = replaceModernColorSyntax(raw)
    }
  }
  return () => {
    for (const [el, original] of originals) {
      el.textContent = original
    }
  }
}

/**
 * Patch every <style> element in the cloned document, and replace every same-
 * origin <link rel="stylesheet"> with an inlined+patched <style> so html2canvas
 * never fetches or parses raw oklch from the stylesheet text.
 */
function inlineAdoptedStyleSheetsIntoStyleTags(clonedDoc: Document): void {
  const adopted = clonedDoc.adoptedStyleSheets
  if (!adopted?.length) return
  const chunks: string[] = []
  for (const sheet of Array.from(adopted)) {
    try {
      chunks.push(Array.from(sheet.cssRules).map((r) => r.cssText).join('\n'))
    } catch {
      /* cross-origin or restricted rules */
    }
  }
  if (chunks.length === 0) return
  try {
    clonedDoc.adoptedStyleSheets = []
  } catch {
    /* not replaceable in this environment */
  }
  const head = clonedDoc.head ?? clonedDoc.documentElement
  for (const raw of chunks) {
    const styleEl = clonedDoc.createElement('style')
    styleEl.textContent = hasModernColorSyntax(raw) ? replaceModernColorSyntax(raw) : raw
    head.appendChild(styleEl)
  }
}

function patchClonedDocStylesheets(clonedDoc: Document): void {
  inlineAdoptedStyleSheetsIntoStyleTags(clonedDoc)

  // 1. Inline <style> elements (may already be patched by patchLiveStylesAndGetRestorer,
  //    but re-check in case any were injected after cloning).
  for (const el of Array.from(clonedDoc.querySelectorAll<HTMLStyleElement>('style'))) {
    const raw = el.textContent ?? ''
    if (hasModernColorSyntax(raw)) {
      el.textContent = replaceModernColorSyntax(raw)
    }
  }

  // 2. Build a lookup table from the ORIGINAL document's CSSOM:
  //    exact href → sheet, and pathname → sheet as fallback (handles Vite query params).
  const sheetByHref = new Map<string, CSSStyleSheet>()
  const sheetByPath = new Map<string, CSSStyleSheet>()
  for (const sheet of Array.from(document.styleSheets)) {
    if (!sheet.href) continue
    try {
      Array.from(sheet.cssRules) // throws for cross-origin
      sheetByHref.set(sheet.href, sheet)
      try { sheetByPath.set(new URL(sheet.href).pathname, sheet) } catch { /* ignore */ }
    } catch { /* cross-origin */ }
  }

  // 3. Replace every <link> in the clone with an inlined patched <style>.
  for (const link of Array.from(
    clonedDoc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'),
  )) {
    let sheet = sheetByHref.get(link.href)
    if (!sheet) {
      try { sheet = sheetByPath.get(new URL(link.href).pathname) } catch { /* ignore */ }
    }
    if (!sheet) continue
    try {
      const rules = Array.from(sheet.cssRules)
      if (rules.length === 0) continue
      const cssText = rules.map((r) => r.cssText).join('\n')
      const styleEl = clonedDoc.createElement('style')
      styleEl.textContent = hasModernColorSyntax(cssText)
        ? replaceModernColorSyntax(cssText)
        : cssText
      link.replaceWith(styleEl)
    } catch { /* unexpected */ }
  }
}

function applyResolvedColorsToClone(clonedRoot: HTMLElement, originalRoot: HTMLElement) {
  const queue: Array<[HTMLElement, HTMLElement]> = [[clonedRoot, originalRoot]]

  while (queue.length > 0) {
    const pair = queue.pop()
    if (!pair) break
    const [clone, orig] = pair

    if (clone.nodeType !== Node.ELEMENT_NODE || orig.nodeType !== Node.ELEMENT_NODE) continue

    const computed = window.getComputedStyle(orig)
    const bgImage = computed.backgroundImage

    clone.style.color = normalizeCssColor(computed.color)
    clone.style.borderTopColor = normalizeCssColor(computed.borderTopColor)
    clone.style.borderRightColor = normalizeCssColor(computed.borderRightColor)
    clone.style.borderBottomColor = normalizeCssColor(computed.borderBottomColor)
    clone.style.borderLeftColor = normalizeCssColor(computed.borderLeftColor)
    clone.style.outlineColor = normalizeCssColor(computed.outlineColor)
    clone.style.textDecorationColor = normalizeCssColor(computed.textDecorationColor)
    clone.style.caretColor = normalizeCssColor(computed.caretColor)

    const bg = computed.backgroundColor
    clone.style.backgroundColor = normalizeCssColor(bg)

    if (bgImage && bgImage !== 'none') {
      clone.style.backgroundImage = 'none'
    }

    // Shadows can carry unsupported color functions; disable for stable capture.
    clone.style.boxShadow = 'none'

    const cloneChildren = Array.from(clone.children).filter(
      (n): n is HTMLElement => n.nodeType === Node.ELEMENT_NODE,
    )
    const origChildren = Array.from(orig.children).filter(
      (n): n is HTMLElement => n.nodeType === Node.ELEMENT_NODE,
    )
    const len = Math.min(cloneChildren.length, origChildren.length)
    for (let i = 0; i < len; i += 1) {
      queue.push([cloneChildren[i], origChildren[i]])
    }
  }
}

function html2canvasOpts(element: HTMLElement) {
  return {
    scale: 2,
    logging: false,
    useCORS: true,
    backgroundColor: '#ffffff' as const,
    onclone(clonedDoc: Document, clonedElement: HTMLElement) {
      // Must patch stylesheets FIRST so the parser never sees oklch.
      patchClonedDocStylesheets(clonedDoc)
      // Then inline all computed colours as rgb fallback.
      applyResolvedColorsToClone(clonedElement, element)
    },
  } satisfies Parameters<typeof html2canvas>[1]
}

function boolLabel(v: boolean) {
  return v ? 'Yes' : 'No'
}

export function submissionToPlainText(sub: Submission): string {
  const { data } = sub
  const lines = [
    'FormFlow - Order Details',
    `Submission ID: ${sub.id}`,
    `Created: ${formatDateTimeDotDMY(sub.createdAt)}`,
    '',
    '--- Order Identity ---',
    `Order Date: ${formatDateDotDMY(data.orderDate) || '-'}`,
    `Delivered By: ${formatDateDotDMY(data.deliveredBy) || data.deliveredBy || '-'}`,
    `Job No: ${data.jobNo}`,
    `Order Name: ${data.orderName}`,
    `Owner Name: ${data.ownerName}`,
    `NIC: ${data.nic || '-'}`,
    `Address: ${data.address || '-'}`,
    '',
    '--- Print ---',
    `Fabric: ${data.fabric}`,
    `Quantity: ${data.quantity}`,
    'Size:',
    `  Height: ${data.sizeHeight || '-'}`,
    `  Width: ${data.sizeWidth || '-'}`,
    `Method: ${data.method || '-'}`,
    `Type: ${data.printType}`,
    `Description: ${data.printDescription || '-'}`,
    '',
    '--- Other ---',
    `Sewing Yes: ${boolLabel(data.sewYes)}`,
    `Sewing No: ${boolLabel(data.sewNo)}`,
    `Sew Top: ${boolLabel(data.sewCornerTop)} ${data.sewCornerTopText || ''}`.trim(),
    `Sew Top Left: ${data.sewCornerTopLeftText || '-'}`.trim(),
    `Sew Top Right: ${data.sewCornerTopRightText || '-'}`.trim(),
    `Sew Left: ${boolLabel(data.sewCornerLeft)} ${data.sewCornerLeftText || ''}`.trim(),
    `Sew Right: ${boolLabel(data.sewCornerRight)} ${data.sewCornerRightText || ''}`.trim(),
    `Sew Bottom: ${boolLabel(data.sewCornerBottom)} ${data.sewCornerBottomText || ''}`.trim(),
    `Delivery Notes: ${data.deliveryNotes || '-'}`,
    `Additional Notes: ${data.notes || '-'}`,
  ]
  return lines.join('\n')
}

export function submissionToJson(sub: Submission): string {
  return JSON.stringify({ id: sub.id, createdAt: sub.createdAt, data: sub.data }, null, 2)
}

/**
 * Prefer html-to-image: it rasterises via the browser (SVG foreignObject), so
 * Tailwind v4 / oklch() in stylesheets works. html2canvas uses its own CSS parser
 * and throws on oklch — kept only as a fallback.
 */
async function captureCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  try {
    return await toCanvas(element, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: true,
      // Cross-origin stylesheets (e.g. Google Fonts) block cssRules; skip font embed.
      skipFonts: true,
    })
  } catch {
    const restore = patchLiveStylesAndGetRestorer()
    try {
      return await html2canvas(element, html2canvasOpts(element))
    } finally {
      restore()
    }
  }
}

export async function downloadSubmissionPng(element: HTMLElement, fileBaseName: string) {
  const canvas = await captureCanvas(element)
  const dataUrl = canvas.toDataURL('image/png')
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `${fileBaseName}.png`
  link.rel = 'noopener'
  link.click()
}

function sanitizePdfFileBaseName(name: string): string {
  const trimmed = name.trim() || 'document'
  return trimmed.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '-').slice(0, 120)
}

/** jsPDF A4 portrait, points — matches browser print @page A4. */
const PDF_MARGIN_PT = 40

function newA4Pdf(): jsPDF {
  return new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
}

/** Full printable width, top-aligned — good for order summary (match width; height follows content). */
function addCanvasFullWidthTopAligned(pdf: jsPDF, canvas: HTMLCanvasElement, marginPt: number) {
  const pageW = pdf.internal.pageSize.getWidth()
  const maxW = pageW - 2 * marginPt
  const cw = canvas.width
  const ch = canvas.height
  if (cw <= 0 || ch <= 0) return

  const dispW = maxW
  const dispH = (ch * dispW) / cw
  const imgData = canvas.toDataURL('image/png')
  pdf.addImage(imgData, 'PNG', marginPt, marginPt, dispW, dispH)
}

/**
 * Scale raster to cover the full A4 margin box (like print CSS on .quotation-template / .invoice-template).
 * Fixes “tiny quotation at top, huge white band below” when the capture is wider-than-tall in pixels.
 */
function addCanvasCoverA4Margins(pdf: jsPDF, canvas: HTMLCanvasElement, marginPt: number) {
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const maxW = pageW - 2 * marginPt
  const maxH = pageH - 2 * marginPt
  const cw = canvas.width
  const ch = canvas.height
  if (cw <= 0 || ch <= 0) return

  const scale = Math.max(maxW / cw, maxH / ch)
  const dispW = cw * scale
  const dispH = ch * scale
  const x = marginPt + (maxW - dispW) / 2
  const y = marginPt + (maxH - dispH) / 2
  const imgData = canvas.toDataURL('image/png')
  pdf.addImage(imgData, 'PNG', x, y, dispW, dispH)
}

function canvasScaledHeightAtFullWidth(canvas: HTMLCanvasElement, maxW: number): number {
  if (canvas.width <= 0) return 0
  return (canvas.height * maxW) / canvas.width
}

/** Full width between margins, tile vertically across A4 pages. */
function appendCanvasFullWidthTiledToPdf(pdf: jsPDF, canvas: HTMLCanvasElement, margin: number) {
  const imgData = canvas.toDataURL('image/png')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const usableH = pageHeight - margin * 2
  const imgW = pageWidth - margin * 2
  const imgH = (canvas.height * imgW) / canvas.width

  let y = margin
  let heightLeft = imgH

  pdf.addImage(imgData, 'PNG', margin, y, imgW, imgH)
  heightLeft -= usableH

  while (heightLeft > 0) {
    y = margin - (imgH - heightLeft)
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', margin, y, imgW, imgH)
    heightLeft -= usableH
  }
}

export async function downloadSubmissionPdf(element: HTMLElement, fileBaseName: string) {
  const canvas = await captureCanvas(element)
  const pdf = newA4Pdf()
  const m = PDF_MARGIN_PT
  const maxW = pdf.internal.pageSize.getWidth() - 2 * m
  const maxH = pdf.internal.pageSize.getHeight() - 2 * m
  const scaledH = canvasScaledHeightAtFullWidth(canvas, maxW)
  if (scaledH <= maxH) {
    addCanvasFullWidthTopAligned(pdf, canvas, m)
  } else {
    appendCanvasFullWidthTiledToPdf(pdf, canvas, m)
  }
  pdf.save(`${sanitizePdfFileBaseName(fileBaseName)}.pdf`)
}

/**
 * A4 PDF like browser print: page 1 = order summary; page 2 = quotation/invoice sheet-filling (cover scale).
 */
export async function downloadOrderAndLetterheadDocumentPdf(
  orderSummaryElement: HTMLElement | null | undefined,
  letterheadDocumentElement: HTMLElement,
  fileBaseName: string,
) {
  const pdf = newA4Pdf()
  const m = PDF_MARGIN_PT
  const maxW = pdf.internal.pageSize.getWidth() - 2 * m
  const maxH = pdf.internal.pageSize.getHeight() - 2 * m

  if (orderSummaryElement) {
    const orderCanvas = await captureCanvas(orderSummaryElement)
    const orderScaledH = canvasScaledHeightAtFullWidth(orderCanvas, maxW)
    if (orderScaledH <= maxH) {
      addCanvasFullWidthTopAligned(pdf, orderCanvas, m)
    } else {
      appendCanvasFullWidthTiledToPdf(pdf, orderCanvas, m)
    }
    pdf.addPage()
  }

  const letterCanvas = await captureCanvas(letterheadDocumentElement)
  const letterScaledH = canvasScaledHeightAtFullWidth(letterCanvas, maxW)
  if (letterScaledH > maxH) {
    appendCanvasFullWidthTiledToPdf(pdf, letterCanvas, m)
  } else {
    addCanvasCoverA4Margins(pdf, letterCanvas, m)
  }
  pdf.save(`${sanitizePdfFileBaseName(fileBaseName)}.pdf`)
}

function mergeCanvasesVertical(
  top: HTMLCanvasElement,
  bottom: HTMLCanvasElement,
  gapPx: number,
): HTMLCanvasElement {
  const w = Math.max(top.width, bottom.width)
  const h = top.height + gapPx + bottom.height
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  if (!ctx) {
    throw new Error('Could not create canvas context.')
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(top, (w - top.width) / 2, 0)
  ctx.drawImage(bottom, (w - bottom.width) / 2, top.height + gapPx)
  return out
}

async function copyPngCanvasToClipboard(canvas: HTMLCanvasElement) {
  if (!window.isSecureContext) {
    throw new Error(
      'Copy image needs a secure page (https:// or http://localhost). Open the app that way and try again.',
    )
  }
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('This browser does not support copying images to the clipboard.')
  }

  const pngPromise = new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result)
        return
      }
      reject(new Error('Could not create an image from the form (canvas export failed).'))
    }, 'image/png')
  })

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': pngPromise,
      }),
    ])
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      throw new Error(
        'Clipboard access was blocked. Allow clipboard permission for this site, or use Download PDF.',
      )
    }
    throw err instanceof Error ? err : new Error('Could not copy image to the clipboard.')
  }
}

export async function copyElementImageToClipboard(element: HTMLElement) {
  const canvas = await captureCanvas(element)
  await copyPngCanvasToClipboard(canvas)
}

/** Stacked image: order summary on top, letterhead document below (quotation or invoice). */
export async function copyOrderAndDocumentImageToClipboard(
  orderSummaryElement: HTMLElement,
  letterheadDocumentElement: HTMLElement,
) {
  const top = await captureCanvas(orderSummaryElement)
  const bottom = await captureCanvas(letterheadDocumentElement)
  const merged = mergeCanvasesVertical(top, bottom, 24)
  await copyPngCanvasToClipboard(merged)
}

export async function copySurveyAndQuotationImageToClipboard(
  surveyElement: HTMLElement,
  quotationElement: HTMLElement,
) {
  return copyOrderAndDocumentImageToClipboard(surveyElement, quotationElement)
}

export async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text)
}

