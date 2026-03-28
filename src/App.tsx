import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { firebaseDb } from './lib/firebase'
import { startFirestoreInvoicesListener } from './lib/firestoreInvoices'
import { startFirestoreSubmissionsListener } from './lib/firestoreSubmissions'
import { DashboardPage } from './pages/DashboardPage'
import { EditSurveyPage } from './pages/EditSurveyPage'
import { NewSurveyPage } from './pages/NewSurveyPage'
import { InvoicePage } from './pages/InvoicePage'
import { InvoicesListPage } from './pages/InvoicesListPage'
import { QuotationPage } from './pages/QuotationPage'
import { QuotationsListPage } from './pages/QuotationsListPage'
import { SubmissionDetailPage } from './pages/SubmissionDetailPage'
import { useInvoicesStore } from './store/useInvoicesStore'
import { useSubmissionsStore } from './store/useSubmissionsStore'

export default function App() {
  useEffect(() => {
    if (!firebaseDb) return
    const unsubSubmissions = startFirestoreSubmissionsListener(
      (list) => useSubmissionsStore.getState().applyRemoteSubmissions(list),
      (msg) => useSubmissionsStore.getState().setFirestoreError(msg),
    )
    const unsubInvoices = startFirestoreInvoicesListener(
      (list) => useInvoicesStore.getState().applyRemoteInvoices(list),
      (msg) => useInvoicesStore.getState().setFirestoreError(msg),
    )
    return () => {
      unsubSubmissions()
      unsubInvoices()
    }
  }, [])

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="survey" element={<NewSurveyPage />} />
        <Route path="quotations" element={<QuotationsListPage />} />
        <Route path="quotation/:submissionId" element={<QuotationPage />} />
        <Route path="quotation" element={<QuotationPage />} />
        <Route path="invoices" element={<InvoicesListPage />} />
        <Route path="invoice/:invoiceId" element={<InvoicePage />} />
        <Route path="invoice" element={<InvoicePage />} />
        <Route path="submission/:id/edit" element={<EditSurveyPage />} />
        <Route path="submission/:id" element={<SubmissionDetailPage />} />
      </Route>
    </Routes>
  )
}
