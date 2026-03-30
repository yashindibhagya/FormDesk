import * as admin from 'firebase-admin'
import { info, warn } from 'firebase-functions/logger'
import { onRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFinancialYearLabel } from './financialYear'

admin.initializeApp()

const BATCH = 500

function toDate(raw: unknown): Date | null {
  if (raw instanceof admin.firestore.Timestamp) return raw.toDate()
  if (typeof raw === 'string') {
    const t = Date.parse(raw)
    if (!Number.isNaN(t)) return new Date(t)
  }
  return null
}

function toTimestamp(raw: unknown): admin.firestore.Timestamp | null {
  if (raw instanceof admin.firestore.Timestamp) return raw
  if (typeof raw === 'string') {
    const t = Date.parse(raw)
    if (!Number.isNaN(t)) return admin.firestore.Timestamp.fromDate(new Date(t))
  }
  return null
}

async function backfillCollectionFinancialYear(coll: string): Promise<number> {
  const db = admin.firestore()
  let totalUpdated = 0
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null
  for (;;) {
    const base = db.collection(coll).orderBy(admin.firestore.FieldPath.documentId())
    let queryRef: FirebaseFirestore.Query = base.limit(BATCH)
    if (cursor) queryRef = base.startAfter(cursor.id).limit(BATCH)
    const snap: FirebaseFirestore.QuerySnapshot = await queryRef.get()
    if (snap.empty) break
    let changed = 0
    const batch = db.batch()
    for (const d of snap.docs) {
      const raw = d.data()
      const created = toDate(raw.createdAt)
      if (!created) {
        warn('Skipping doc without parseable createdAt', { coll, id: d.id })
        continue
      }
      const patch: Record<string, unknown> = {}
      const hasFinancialYear = typeof raw.financialYear === 'string' && raw.financialYear.trim().length > 0
      if (!hasFinancialYear) patch.financialYear = getFinancialYearLabel(created)

      const createdAtTs = toTimestamp(raw.createdAt)
      if (createdAtTs && !(raw.createdAt instanceof admin.firestore.Timestamp)) patch.createdAt = createdAtTs

      if (coll === 'invoices') {
        const updatedAtTs = toTimestamp(raw.updatedAt)
        if (updatedAtTs && !(raw.updatedAt instanceof admin.firestore.Timestamp)) {
          patch.updatedAt = updatedAtTs
        }
      }

      if (Object.keys(patch).length === 0) continue
      batch.set(d.ref, patch, { merge: true })
      changed += 1
    }
    if (changed > 0) {
      await batch.commit()
      totalUpdated += changed
    }
    cursor = snap.docs[snap.docs.length - 1] ?? null
    if (snap.size < BATCH) break
  }
  return totalUpdated
}

function twoYearCutoffTimestamp(now: Date = new Date()): admin.firestore.Timestamp {
  const cutoff = new Date(now)
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 2)
  return admin.firestore.Timestamp.fromDate(cutoff)
}

async function purgeCollectionOlderThanTwoYears(coll: string): Promise<number> {
  const db = admin.firestore()
  const cutoff = twoYearCutoffTimestamp()
  let totalDeleted = 0
  for (;;) {
    const snap = await db
      .collection(coll)
      .where('createdAt', '<', cutoff)
      .orderBy('createdAt', 'asc')
      .limit(BATCH)
      .get()
    if (snap.empty) break
    const batch = db.batch()
    for (const d of snap.docs) batch.delete(d.ref)
    await batch.commit()
    totalDeleted += snap.size
    if (snap.size < BATCH) break
  }
  return totalDeleted
}

/**
 * One-time migration endpoint: backfills financialYear for existing docs.
 * Set MIGRATION_KEY secret and call with header: x-migration-key: <value>
 */
export const backfillFinancialYear = onRequest({ region: 'europe-west1' }, async (req, res) => {
  const expected = process.env.MIGRATION_KEY?.trim()
  const received = String(req.headers['x-migration-key'] ?? '').trim()
  if (!expected || received !== expected) {
    res.status(403).json({ ok: false, message: 'Forbidden' })
    return
  }

  const [submissionsUpdated, invoicesUpdated] = await Promise.all([
    backfillCollectionFinancialYear('submissions'),
    backfillCollectionFinancialYear('invoices'),
  ])
  info('Backfilled financialYear', { submissionsUpdated, invoicesUpdated })
  res.json({ ok: true, submissionsUpdated, invoicesUpdated })
})

/** Scheduled cleanup: delete records older than 2 years by createdAt. */
export const purgeRecordsOlderThanTwoYears = onSchedule(
  {
    schedule: '0 2 * * *',
    timeZone: 'UTC',
    region: 'europe-west1',
  },
  async () => {
    const [submissionsDeleted, invoicesDeleted] = await Promise.all([
      purgeCollectionOlderThanTwoYears('submissions'),
      purgeCollectionOlderThanTwoYears('invoices'),
    ])
    info('Purged records older than two years', { submissionsDeleted, invoicesDeleted })
  },
)
