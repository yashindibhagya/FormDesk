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
import type { Submission, SurveyFormData } from '../types/survey'
import { EMPTY_SURVEY } from '../types/survey'

const COLL = 'submissions'

function normalizeSubmission(id: string, raw: Record<string, unknown> | undefined): Submission | null {
  if (!raw) return null
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : null
  const surveyData = raw.data
  if (!createdAt || !surveyData || typeof surveyData !== 'object' || Array.isArray(surveyData)) return null
  return {
    id,
    createdAt,
    data: { ...EMPTY_SURVEY, ...(surveyData as SurveyFormData) },
  }
}

export async function saveSubmissionToFirestore(sub: Submission): Promise<void> {
  if (!firebaseDb) throw new Error('Firestore is not configured')
  await setDoc(
    doc(firebaseDb, COLL, sub.id),
    {
      createdAt: sub.createdAt,
      data: sub.data,
    },
    { merge: true },
  )
}

export async function deleteSubmissionFromFirestore(id: string): Promise<void> {
  if (!firebaseDb) return
  await deleteDoc(doc(firebaseDb, COLL, id))
}

let activeUnsub: Unsubscribe | null = null

export function startFirestoreSubmissionsListener(
  onUpdate: (list: Submission[]) => void,
  onError: (message: string) => void,
): () => void {
  if (!firebaseDb) return () => {}

  const db = firebaseDb
  const q = query(collection(db, COLL), orderBy('createdAt', 'desc'))
  activeUnsub = onSnapshot(
    q,
    (snap) => {
      const list: Submission[] = []
      snap.forEach((d) => {
        const s = normalizeSubmission(d.id, d.data() as Record<string, unknown> | undefined)
        if (s) list.push(s)
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
