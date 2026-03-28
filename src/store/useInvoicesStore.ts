import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { firebaseDb } from '../lib/firebase'
import { deleteInvoiceFromFirestore, saveInvoiceToFirestore } from '../lib/firestoreInvoices'
import { STORAGE_KEYS } from '../lib/constants'
import type { InvoiceFormData, InvoiceRecord } from '../types/invoice'

type InvoicesState = {
  invoices: InvoiceRecord[]
  firestoreReady: boolean
  firestoreError: string | null
  applyRemoteInvoices: (list: InvoiceRecord[]) => void
  setFirestoreError: (message: string | null) => void
  saveInvoice: (input: {
    id?: string
    submissionId: string | null
    data: InvoiceFormData
  }) => Promise<string>
  deleteInvoice: (id: string) => Promise<void>
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

const createInvoicesSlice = (
  set: (partial: Partial<InvoicesState> | ((s: InvoicesState) => Partial<InvoicesState>)) => void,
  get: () => InvoicesState,
): InvoicesState => ({
  invoices: [],
  firestoreReady: !useFirebase,
  firestoreError: null,

  applyRemoteInvoices: (list) =>
    set({ invoices: list, firestoreReady: true, firestoreError: null }),

  setFirestoreError: (message) => set({ firestoreError: message, firestoreReady: true }),

  saveInvoice: async ({ id: inputId, submissionId, data }) => {
    const id = inputId ?? crypto.randomUUID()
    const now = new Date().toISOString()
    const prev = get().invoices.find((i) => i.id === id)
    const record: InvoiceRecord = {
      id,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      submissionId,
      data,
    }
    if (useFirebase) {
      try {
        await saveInvoiceToFirestore(record)
        set({
          invoices: [record, ...get().invoices.filter((i) => i.id !== id)],
          firestoreError: null,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to save invoice'
        set({ firestoreError: msg })
        throw err
      }
      return id
    }
    set({
      invoices: [record, ...get().invoices.filter((i) => i.id !== id)],
    })
    return id
  },

  deleteInvoice: async (id) => {
    if (useFirebase) {
      try {
        await deleteInvoiceFromFirestore(id)
        set({
          invoices: get().invoices.filter((i) => i.id !== id),
          firestoreError: null,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to delete invoice'
        set({ firestoreError: msg })
        throw err
      }
      return
    }
    set({ invoices: get().invoices.filter((i) => i.id !== id) })
  },
})

export const useInvoicesStore = useFirebase
  ? create<InvoicesState>()((set, get) => createInvoicesSlice(set, get))
  : create<InvoicesState>()(
      persist((set, get) => createInvoicesSlice(set, get), {
        name: STORAGE_KEYS.invoices,
        storage: createJSONStorage(() => indexedDbStorage),
        partialize: (state) => ({
          invoices: state.invoices,
        }),
      }),
    )
