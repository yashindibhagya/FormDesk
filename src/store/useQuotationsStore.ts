import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { firebaseDb } from '../lib/firebase'
import { deleteQuotationFromFirestore, saveQuotationToFirestore } from '../lib/firestoreQuotations'
import { STORAGE_KEYS } from '../lib/constants'
import { getFinancialYearLabel } from '../lib/financialYear'
import type { QuotationFormData, QuotationRecord } from '../types/quotation'

type QuotationsState = {
  quotations: QuotationRecord[]
  firestoreReady: boolean
  firestoreError: string | null
  applyRemoteQuotations: (list: QuotationRecord[]) => void
  setFirestoreError: (message: string | null) => void
  saveQuotation: (input: {
    id?: string
    submissionId: string | null
    data: QuotationFormData
  }) => Promise<string>
  deleteQuotation: (id: string) => Promise<void>
}

const DB_NAME = 'formflow-db'
const STORE_NAME = 'kv'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode)
        const store = tx.objectStore(STORE_NAME)
        const request = action(store)

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }),
  )
}

const indexedDbStorage = {
  getItem: async (name: string) => {
    try {
      const value = await withStore('readonly', (store) => store.get(name))
      if (typeof value === 'string') return value
      if (value == null) return null
      return String(value)
    } catch {
      return localStorage.getItem(name)
    }
  },
  setItem: async (name: string, value: string) => {
    await withStore('readwrite', (store) => store.put(value, name))
  },
  removeItem: async (name: string) => {
    await withStore('readwrite', (store) => store.delete(name))
  },
}

const useFirebase = Boolean(firebaseDb)

const createQuotationsSlice = (
  set: (partial: Partial<QuotationsState> | ((s: QuotationsState) => Partial<QuotationsState>)) => void,
  get: () => QuotationsState,
): QuotationsState => ({
  quotations: [],
  firestoreReady: !useFirebase,
  firestoreError: null,

  applyRemoteQuotations: (list) =>
    set({ quotations: list, firestoreReady: true, firestoreError: null }),

  setFirestoreError: (message) => set({ firestoreError: message, firestoreReady: true }),

  saveQuotation: async ({ id: inputId, submissionId, data }) => {
    const id = inputId ?? submissionId ?? crypto.randomUUID()
    const now = new Date().toISOString()
    const prev = get().quotations.find((q) => q.id === id)
    const record: QuotationRecord = {
      id,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      financialYear: prev?.financialYear ?? getFinancialYearLabel(prev?.createdAt ?? now),
      submissionId,
      data,
    }
    if (useFirebase) {
      try {
        await saveQuotationToFirestore(record)
        set({
          quotations: [record, ...get().quotations.filter((q) => q.id !== id)],
          firestoreError: null,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to save quotation'
        set({ firestoreError: msg })
        throw err
      }
      return id
    }
    set({
      quotations: [record, ...get().quotations.filter((q) => q.id !== id)],
    })
    return id
  },

  deleteQuotation: async (id) => {
    if (useFirebase) {
      try {
        await deleteQuotationFromFirestore(id)
        set({
          quotations: get().quotations.filter((q) => q.id !== id),
          firestoreError: null,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to delete quotation'
        set({ firestoreError: msg })
        throw err
      }
      return
    }
    set({ quotations: get().quotations.filter((q) => q.id !== id) })
  },
})

export const useQuotationsStore = useFirebase
  ? create<QuotationsState>()((set, get) => createQuotationsSlice(set, get))
  : create<QuotationsState>()(
      persist((set, get) => createQuotationsSlice(set, get), {
        name: STORAGE_KEYS.quotations,
        storage: createJSONStorage(() => indexedDbStorage),
        partialize: (state) => ({
          quotations: state.quotations,
        }),
      }),
    )
