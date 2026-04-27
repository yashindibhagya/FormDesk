import { formatDateDotDMY } from '../../lib/dateDisplay'
import type { QuotationLineItem } from '../../types/quotation'
import { formatLineAmount, sumLineAmounts } from '../../types/quotation'

type Props = {
  letterheadUrl: string
  quotationDate: string
  customerAddress: string
  subject: string
  introText: string
  lineItems: QuotationLineItem[]
  lineItemsSecondary?: QuotationLineItem[]
  paymentNote: string
  closingNote: string
  signatoryLine: string
  signatoryName: string
}

export function QuotationTemplate({
  letterheadUrl,
  quotationDate,
  customerAddress,
  subject,
  introText,
  lineItems,
  lineItemsSecondary = [],
  paymentNote,
  closingNote,
  signatoryLine,
  signatoryName,
}: Props) {
  const total = sumLineAmounts(lineItems)
  const totalSecondary = sumLineAmounts(lineItemsSecondary)
  const totalFormatted =
    total > 0
      ? total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '—'
  const totalSecondaryFormatted =
    totalSecondary > 0
      ? totalSecondary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '—'
  const hasSecondaryRows = lineItemsSecondary.some(
    (row) => row.description.trim() || row.qty.trim() || row.unitPrice.trim(),
  )

  return (
    <article
      className="quotation-template relative mx-auto box-border min-h-[297mm] w-full max-w-[210mm] overflow-hidden border border-slate-300 bg-white text-slate-900 shadow-md print:max-w-none print:border-0 print:shadow-none"
      style={{
        backgroundImage: `url(${letterheadUrl})`,
        backgroundSize: '100% 100%',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Leave top space for letterhead graphic in `invoice plain.jpg.jpeg`; tweak `pt-*` if body overlaps the image header. */}
      <div className="relative z-[1] px-10 pb-12 pt-36 text-[13px] leading-relaxed print:px-12 sm:pt-40">
        <div className="mb-6 grid gap-1 text-[13px]">
          <p>
            <span className="font-semibold">Date:</span> {formatDateDotDMY(quotationDate) || '—'}
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
          QUOTATION FOR {subject.trim() || '—'}
        </h2>

        <p className="mb-6 text-justify">{introText}</p>
        <p className="mb-2 text-[12px] font-semibold uppercase">Quotation 01</p>
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
          </tbody>
        </table>

        {hasSecondaryRows ? (
          <>
            <p className="mb-2 text-[12px] font-semibold uppercase">Quotation 02</p>
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
                {lineItemsSecondary.map((row) => {
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
                  <td className="border border-black px-2 py-2 text-right tabular-nums">{totalSecondaryFormatted}</td>
                </tr>
              </tbody>
            </table>
          </>
        ) : null}

        <p className="mb-4 text-justify text-[12px] font-semibold">{paymentNote}</p>

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
