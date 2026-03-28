import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { firebaseDb } from '../lib/firebase'
import {
  deleteSubmissionFromFirestore,
  saveSubmissionToFirestore,
} from '../lib/firestoreSubmissions'
import { STORAGE_KEYS } from '../lib/constants'
import type { Submission, SurveyFormData } from '../types/survey'

type SubmissionsState = {
  submissions: Submission[]
  /** False until first Firestore snapshot (Firebase mode only). */
  firestoreReady: boolean
  firestoreError: string | null
  applyRemoteSubmissions: (list: Submission[]) => void
  setFirestoreError: (message: string | null) => void
  addSubmission: (data: SurveyFormData) => Promise<string>
  updateSubmission: (id: string, data: SurveyFormData) => Promise<void>
  deleteSubmission: (id: string) => Promise<void>
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

const createSubmissionsSlice = (
  set: (partial: Partial<SubmissionsState> | ((s: SubmissionsState) => Partial<SubmissionsState>)) => void,
  get: () => SubmissionsState,
): SubmissionsState => ({
  submissions: [],
  firestoreReady: !useFirebase,
  firestoreError: null,

  applyRemoteSubmissions: (list) =>
    set({ submissions: list, firestoreReady: true, firestoreError: null }),

  setFirestoreError: (message) =>
    set({ firestoreError: message, firestoreReady: true }),

  addSubmission: async (data) => {
    const id = crypto.randomUUID()
    const submission: Submission = {
      id,
      data,
      createdAt: new Date().toISOString(),
    }
    if (useFirebase) {
      try {
        await saveSubmissionToFirestore(submission)
        set({
          submissions: [submission, ...get().submissions.filter((s) => s.id !== id)],
          firestoreError: null,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to save order'
        set({ firestoreError: msg })
        throw err
      }
      return id
    }
    set({ submissions: [submission, ...get().submissions] })
    return id
  },

  updateSubmission: async (id, data) => {
    const prev = get().submissions.find((s) => s.id === id)
    const createdAt = prev?.createdAt ?? new Date().toISOString()
    const submission: Submission = { id, data, createdAt }
    if (useFirebase) {
      try {
        await saveSubmissionToFirestore(submission)
        set({
          submissions: get().submissions.map((s) => (s.id === id ? submission : s)),
          firestoreError: null,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update order'
        set({ firestoreError: msg })
        throw err
      }
      return
    }
    set({
      submissions: get().submissions.map((s) => (s.id === id ? { ...s, data } : s)),
    })
  },

  deleteSubmission: async (id) => {
    if (useFirebase) {
      try {
        await deleteSubmissionFromFirestore(id)
        set({
          submissions: get().submissions.filter((s) => s.id !== id),
          firestoreError: null,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to delete order'
        set({ firestoreError: msg })
        throw err
      }
      return
    }
    set({ submissions: get().submissions.filter((s) => s.id !== id) })
  },
})

export const useSubmissionsStore = useFirebase
  ? create<SubmissionsState>()((set, get) => createSubmissionsSlice(set, get))
  : create<SubmissionsState>()(
      persist((set, get) => createSubmissionsSlice(set, get), {
        name: STORAGE_KEYS.submissions,
        storage: createJSONStorage(() => indexedDbStorage),
        partialize: (state) => ({
          submissions: state.submissions,
        }),
      }),
    )
