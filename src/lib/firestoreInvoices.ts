import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { firebaseDb } from './firebase'
import type { InvoiceFormData, InvoiceRecord } from '../types/invoice'
import { EMPTY_INVOICE_FORM, ensureLineItems } from '../types/invoice'
import { createEmptyLineItem, type QuotationLineItem } from '../types/quotation'

const COLL = 'invoices'

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

function normalizeInvoice(id: string, raw: Record<string, unknown> | undefined): InvoiceRecord | null {
  if (!raw) return null
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : null
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt
  const surveyData = raw.data
  if (!createdAt || !surveyData || typeof surveyData !== 'object' || Array.isArray(surveyData)) return null

  const submissionRaw = raw.submissionId
  const submissionId =
    submissionRaw === null || submissionRaw === undefined
      ? null
      : typeof submissionRaw === 'string'
        ? submissionRaw
        : null

  const partial = surveyData as Partial<InvoiceFormData>
  const data: InvoiceFormData = {
    ...EMPTY_INVOICE_FORM,
    ...partial,
    lineItems: normalizeLineItems(partial.lineItems),
  }

  return {
    id,
    createdAt,
    updatedAt: updatedAt ?? createdAt,
    submissionId,
    data,
  }
}

export async function saveInvoiceToFirestore(record: InvoiceRecord): Promise<void> {
  if (!firebaseDb) throw new Error('Firestore is not configured')
  await setDoc(
    doc(firebaseDb, COLL, record.id),
    {
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      submissionId: record.submissionId,
      data: record.data,
    },
    { merge: true },
  )
}

export async function deleteInvoiceFromFirestore(id: string): Promise<void> {
  if (!firebaseDb) return
  await deleteDoc(doc(firebaseDb, COLL, id))
}

let activeUnsub: Unsubscribe | null = null

export function startFirestoreInvoicesListener(
  onUpdate: (list: InvoiceRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  if (!firebaseDb) return () => {}

  const db = firebaseDb
  const q = query(collection(db, COLL), orderBy('updatedAt', 'desc'))
  activeUnsub = onSnapshot(
    q,
    (snap) => {
      const list: InvoiceRecord[] = []
      snap.forEach((d) => {
        const inv = normalizeInvoice(d.id, d.data() as Record<string, unknown> | undefined)
        if (inv) list.push(inv)
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
