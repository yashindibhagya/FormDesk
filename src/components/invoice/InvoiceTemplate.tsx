import type { QuotationLineItem } from '../../types/quotation'
import { formatLineAmount, parseAmount, sumLineAmounts } from '../../types/quotation'

type Props = {
  letterheadUrl: string
  invoiceDateDisplay: string
  customerAddress: string
  introText: string
  lineItems: QuotationLineItem[]
  advance: string
  closingNote: string
  signatoryLine: string
  signatoryName: string
}

function formatMoney(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function InvoiceTemplate({
  letterheadUrl,
  invoiceDateDisplay,
  customerAddress,
  introText,
  lineItems,
  advance,
  closingNote,
  signatoryLine,
  signatoryName,
}: Props) {
  const total = sumLineAmounts(lineItems)
  const advanceNum = parseAmount(advance)
  const totalFormatted = formatMoney(total)
  const advanceFormatted = advance.trim() && advanceNum > 0 ? formatMoney(advanceNum) : '—'
  const balanceNum = total > 0 ? (advanceNum > 0 ? Math.max(0, total - advanceNum) : total) : 0
  const balanceFormatted = total > 0 ? formatMoney(balanceNum) : '—'

  return (
    <article
      className="invoice-template relative mx-auto box-border min-h-[297mm] w-full max-w-[210mm] overflow-hidden border border-slate-300 bg-white text-slate-900 shadow-md print:max-w-none print:border-0 print:shadow-none"
      style={{
        backgroundImage: `url(${letterheadUrl})`,
        backgroundSize: '100% 100%',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="relative z-[1] px-10 pb-12 pt-36 text-[13px] leading-relaxed print:px-12 sm:pt-40">
        <div className="mb-6 grid gap-1 text-[13px]">
          <p>
            <span className="font-semibold">Date:</span> {invoiceDateDisplay || '—'}
          </p>
          {customerAddress.trim() ? (
            <div className="whitespace-pre-wrap">
              <span className="font-semibold">To:</span>
              {'\n'}
              {customerAddress.trim()}
            </div>
          ) : null}
        </div>

        <p className="mb-3">Dear Sir,</p>

        <h2 className="mb-3 text-center text-sm font-bold uppercase underline decoration-black underline-offset-2">
          INVOICE
        </h2>

        <p className="mb-6 text-justify">{introText}</p>

        <table className="mb-4 w-full border-collapse border border-black text-left text-[12px]">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-black px-2 py-1.5 font-semibold uppercase">Description</th>
              <th className="w-[10%] border border-black px-2 py-1.5 text-center font-semibold uppercase">Qty</th>
              <th className="w-[22%] border border-black px-2 py-1.5 text-right font-semibold uppercase">
                Unit price
              </th>
              <th className="w-[18%] border border-black px-2 py-1.5 text-right font-semibold uppercase">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((row) => {
              const amount = formatLineAmount(row.qty, row.unitPrice)
              return (
                <tr key={row.id}>
                  <td className="border border-black px-2 py-2 align-top whitespace-pre-wrap">{row.description}</td>
                  <td className="border border-black px-2 py-2 text-center align-top tabular-nums">{row.qty}</td>
                  <td className="border border-black px-2 py-2 text-right align-top tabular-nums">{row.unitPrice}</td>
                  <td className="border border-black px-2 py-2 text-right align-top tabular-nums">{amount || '—'}</td>
                </tr>
              )
            })}
            <tr className="font-semibold">
              <td colSpan={3} className="border border-black px-2 py-2 text-right uppercase">
                Total
              </td>
              <td className="border border-black px-2 py-2 text-right tabular-nums">{totalFormatted}</td>
            </tr>
            <tr>
              <td colSpan={2} className="border border-black px-2 py-2" />
              <td className="border border-black px-2 py-2 text-right font-semibold">Advance</td>
              <td className="border border-black px-2 py-2 text-right tabular-nums">{advanceFormatted}</td>
            </tr>
            <tr>
              <td colSpan={2} className="border border-black px-2 py-2" />
              <td className="border border-black px-2 py-2 text-right font-semibold">Balance</td>
              <td
                className="border border-black px-2 py-2 text-right tabular-nums font-semibold [border-bottom:3px_double_rgb(15_23_42)]"
              >
                {balanceFormatted}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mb-8 text-justify text-[12px]">{closingNote}</p>

        <div className="text-[12px]">
          <p>Thanking you,</p>
          <p className="mt-6">Yours faithfully,</p>
          <p className="mt-2 font-semibold">{signatoryLine}</p>
          <p className="mt-1">{signatoryName}</p>
        </div>
      </div>
    </article>
  )
}
