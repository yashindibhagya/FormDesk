import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { firebaseDb } from './firebase'
import { getFinancialYearLabel } from './financialYear'
import {
  createEmptyLineItem,
  EMPTY_QUOTATION_FORM,
  ensureLineItems,
  type QuotationFormData,
  type QuotationLineItem,
  type QuotationRecord,
} from '../types/quotation'

const COLL = 'quotations'

function normalizeLineItems(raw: unknown): QuotationLineItem[] {
  if (!Array.isArray(raw)) return [createEmptyLineItem()]
  const rows = raw
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .map((row) => ({
      id: typeof row.id === 'string' && row.id ? row.id : crypto.randomUUID(),
      description: String(row.description ?? ''),
      qty: String(row.qty ?? ''),
      unitPrice: String(row.unitPrice ?? ''),
    }))
  return ensureLineItems(rows)
}

function normalizeSecondaryLineItems(raw: unknown): QuotationLineItem[] {
  if (!Array.isArray(raw)) return []
  const rows = raw
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .map((row) => ({
      id: typeof row.id === 'string' && row.id ? row.id : crypto.randomUUID(),
      description: String(row.description ?? ''),
      qty: String(row.qty ?? ''),
      unitPrice: String(row.unitPrice ?? ''),
    }))
  return rows
}

function normalizeQuotation(id: string, raw: Record<string, unknown> | undefined): QuotationRecord | null {
  if (!raw) return null
  const createdAtRaw = raw.createdAt
  let createdAt: string | null = null
  if (createdAtRaw instanceof Timestamp) {
    createdAt = createdAtRaw.toDate().toISOString()
  } else if (typeof createdAtRaw === 'string') {
    const t = Date.parse(createdAtRaw)
    createdAt = Number.isNaN(t) ? null : new Date(t).toISOString()
  }
  const updatedAtRaw = raw.updatedAt
  let updatedAt: string | null = null
  if (updatedAtRaw instanceof Timestamp) {
    updatedAt = updatedAtRaw.toDate().toISOString()
  } else if (typeof updatedAtRaw === 'string') {
    const t = Date.parse(updatedAtRaw)
    updatedAt = Number.isNaN(t) ? null : new Date(t).toISOString()
  } else {
    updatedAt = createdAt
  }
  const financialYearRaw = raw.financialYear
  const financialYear =
    typeof financialYearRaw === 'string' && financialYearRaw.trim()
      ? financialYearRaw.trim()
      : createdAt
        ? getFinancialYearLabel(createdAt)
        : null
  const rawData = raw.data
  if (!createdAt || !updatedAt || !financialYear || !rawData || typeof rawData !== 'object' || Array.isArray(rawData)) return null

  const submissionRaw = raw.submissionId
  const submissionId =
    submissionRaw === null || submissionRaw === undefined
      ? null
      : typeof submissionRaw === 'string'
        ? submissionRaw
        : null

  const partial = rawData as Partial<QuotationFormData>
  const data: QuotationFormData = {
    ...EMPTY_QUOTATION_FORM,
    ...partial,
    lineItems: normalizeLineItems(partial.lineItems),
    lineItemsSecondary: normalizeSecondaryLineItems(partial.lineItemsSecondary),
  }

  return {
    id,
    createdAt,
    updatedAt,
    financialYear,
    submissionId,
    data,
  }
}

export async function saveQuotationToFirestore(record: QuotationRecord): Promise<void> {
  if (!firebaseDb) throw new Error('Firestore is not configured')
  const createdAtMs = Date.parse(record.createdAt)
  const updatedAtMs = Date.parse(record.updatedAt)
  const createdAt = Number.isNaN(createdAtMs) ? Timestamp.now() : Timestamp.fromDate(new Date(createdAtMs))
  const updatedAt = Number.isNaN(updatedAtMs) ? Timestamp.now() : Timestamp.fromDate(new Date(updatedAtMs))
  const financialYear = record.financialYear?.trim() || getFinancialYearLabel(createdAt.toDate())
  const persistedData = {
    quotationDate: record.data.quotationDate,
    customerAddress: record.data.customerAddress,
    subject: record.data.subject,
    lineItems: ensureLineItems(record.data.lineItems),
    lineItemsSecondary: record.data.lineItemsSecondary ?? [],
  }
  await setDoc(
    doc(firebaseDb, COLL, record.id),
    {
      createdAt,
      updatedAt,
      financialYear,
      submissionId: record.submissionId,
      data: persistedData,
    },
    { merge: true },
  )
}

export async function deleteQuotationFromFirestore(id: string): Promise<void> {
  if (!firebaseDb) return
  await deleteDoc(doc(firebaseDb, COLL, id))
}

let activeUnsub: Unsubscribe | null = null

export function startFirestoreQuotationsListener(
  onUpdate: (list: QuotationRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  if (!firebaseDb) return () => {}

  const db = firebaseDb
  const q = query(collection(db, COLL), orderBy('updatedAt', 'desc'))
  activeUnsub = onSnapshot(
    q,
    (snap) => {
      const list: QuotationRecord[] = []
      snap.forEach((d) => {
        const qRow = normalizeQuotation(d.id, d.data() as Record<string, unknown> | undefined)
        if (qRow) list.push(qRow)
      })
      onUpdate(list)
    },
    (err) => {
      onError(err.message)
    },
  )

  return () => {
    activeUnsub?.()
    activeUnsub = null
  }
}
