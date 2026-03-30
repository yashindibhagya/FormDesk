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
import type { Submission, SurveyFormData } from '../types/survey'
import { EMPTY_SURVEY } from '../types/survey'

const COLL = 'submissions'
const ACTIVE_SURVEY_FIELDS = [
  'orderDate',
  'deliveredBy',
  'designImage',
  'designThumb1',
  'designThumb2',
  'designThumb3',
  'jobNo',
  'orderName',
  'ownerName',
  'nic',
  'address',
  'fabric',
  'fabricCustom',
  'quantity',
  'quantityNormal',
  'quantityLeft',
  'quantityRight',
  'sizeHeight',
  'sizeWidth',
  'method',
  'printDescription',
  'printType',
  'sewYes',
  'sewNo',
  'sewCornerTopText',
  'sewCornerLeftText',
  'sewCornerRightText',
  'sewCornerBottomText',
  'deliveryNotes',
] as const satisfies ReadonlyArray<keyof SurveyFormData>

function toPersistedSurveyData(data: SurveyFormData): Partial<SurveyFormData> {
  return Object.fromEntries(
    ACTIVE_SURVEY_FIELDS.map((key) => [key, data[key]] as const),
  ) as Partial<SurveyFormData>
}

function normalizeSubmission(id: string, raw: Record<string, unknown> | undefined): Submission | null {
  if (!raw) return null
  const createdAtRaw = raw.createdAt
  let createdAt: string | null = null
  if (createdAtRaw instanceof Timestamp) {
    createdAt = createdAtRaw.toDate().toISOString()
  } else if (typeof createdAtRaw === 'string') {
    const t = Date.parse(createdAtRaw)
    createdAt = Number.isNaN(t) ? null : new Date(t).toISOString()
  }
  const financialYearRaw = raw.financialYear
  const financialYear =
    typeof financialYearRaw === 'string' && financialYearRaw.trim()
      ? financialYearRaw.trim()
      : createdAt
        ? getFinancialYearLabel(createdAt)
        : null
  const surveyData = raw.data
  if (!createdAt || !financialYear || !surveyData || typeof surveyData !== 'object' || Array.isArray(surveyData)) return null
  return {
    id,
    createdAt,
    financialYear,
    data: { ...EMPTY_SURVEY, ...(surveyData as SurveyFormData) },
  }
}

export async function saveSubmissionToFirestore(sub: Submission): Promise<void> {
  if (!firebaseDb) throw new Error('Firestore is not configured')
  const createdAtMs = Date.parse(sub.createdAt)
  const createdAt = Number.isNaN(createdAtMs) ? Timestamp.now() : Timestamp.fromDate(new Date(createdAtMs))
  const financialYear = sub.financialYear?.trim() || getFinancialYearLabel(createdAt.toDate())
  const persistedData = toPersistedSurveyData(sub.data)
  await setDoc(
    doc(firebaseDb, COLL, sub.id),
    {
      createdAt,
      financialYear,
      data: persistedData,
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
