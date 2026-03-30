import type { QuotationLineItem } from '../types/quotation'
import type { SurveyFormData } from '../types/survey'

function baseDescriptionLines(data: SurveyFormData): string[] {
  return [
    data.printDescription?.trim(),
    data.fabric ? `Fabric: ${data.fabric}` : '',
    data.sizeHeight || data.sizeWidth ? `Size: H ${data.sizeHeight || '—'} × W ${data.sizeWidth || '—'}` : '',
    data.method ? `Method: ${data.method}` : '',
  ].filter(Boolean)
}

/**
 * One row for Flag / non-Banner; three rows for Banner (Normal, Left, Right) with
 * `Way : …` on each description and per-way qty.
 */
export function buildLineItemsFromSubmission(data: SurveyFormData): QuotationLineItem[] {
  const base = baseDescriptionLines(data)
  const baseBlock = base.join('\n')

  if (data.printType === 'Banner') {
    const ways: { label: string; qty: string }[] = [
      { label: 'Normal', qty: data.quantityNormal?.trim() ?? '' },
      { label: 'Left', qty: data.quantityLeft?.trim() ?? '' },
      { label: 'Right', qty: data.quantityRight?.trim() ?? '' },
    ]
    return ways.map((w) => ({
      id: crypto.randomUUID(),
      description: baseBlock ? `${baseBlock}\nWay : ${w.label}` : `Way : ${w.label}`,
      qty: w.qty || '—',
      unitPrice: '',
    }))
  }

  return [
    {
      id: crypto.randomUUID(),
      description: baseBlock || '—',
      qty: data.quantity?.trim() || '1',
      unitPrice: '',
    },
  ]
}
