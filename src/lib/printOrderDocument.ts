/**
 * Opens the browser print dialog for order PDFs.
 *
 * - Sets document.title briefly so the print header (if enabled) shows
 *   "PrintCo Orders" instead of "FormFlow Dashboard".
 * - When "Headers and footers" is on, Chrome/Edge add a header (date, title)
 *   and footer (page URL, page numbers). Unchecking that option removes both —
 *   it cannot be done from JavaScript.
 */
const PRINT_TITLE = 'PrintCo Orders'

export function printOrderDocument(): void {
  const previousTitle = document.title
  document.title = PRINT_TITLE

  const restore = () => {
    document.title = previousTitle
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)
  window.setTimeout(restore, 3000)

  window.print()
}
