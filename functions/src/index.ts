/**
 * Scheduled purge: removes Firestore docs whose `createdAt` (ISO string) is before the current
 * fiscal year start (1 Apr → 31 Mar in Asia/Colombo). Run daily; safe to re-run (idempotent).
 *
 * Deploy: from project root, `cd functions && npm install && npm run build`, then
 * `firebase deploy --only functions` (Blaze plan required for schedulers).
 *
 * If you previously enabled Firestore TTL for a 3-month policy, disable/remove that in the
 * Firebase Console so it does not fight this job.
 */
import * as admin from 'firebase-admin'
import { info } from 'firebase-functions/logger'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { currentFiscalYearRetentionCutoffIso } from './fiscalYear'

admin.initializeApp()

const BATCH = 500

async function deleteWhereCreatedAtBefore(
  coll: string,
  cutoffIso: string,
): Promise<number> {
  const db = admin.firestore()
  let total = 0
  for (;;) {
    const snap = await db
      .collection(coll)
      .where('createdAt', '<', cutoffIso)
      .limit(BATCH)
      .get()
    if (snap.empty) break
    const batch = db.batch()
    for (const d of snap.docs) batch.delete(d.ref)
    await batch.commit()
    total += snap.size
    if (snap.size < BATCH) break
  }
  return total
}

export const purgeRecordsBeforeCurrentFiscalYear = onSchedule(
  {
    schedule: '0 2 * * *',
    timeZone: 'UTC',
    region: 'europe-west1',
  },
  async () => {
    const cutoff = currentFiscalYearRetentionCutoffIso()
    const [submissions, invoices] = await Promise.all([
      deleteWhereCreatedAtBefore('submissions', cutoff),
      deleteWhereCreatedAtBefore('invoices', cutoff),
    ])
    info('Fiscal-year retention purge', { cutoff, submissions, invoices })
  },
)
