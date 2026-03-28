import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { firebaseDb } from '../../lib/firebase'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { firebaseConfigured } = useAuth()
  const showOfflineBanner = !firebaseDb || !firebaseConfigured

  return (
    <div className="flex min-h-svh bg-slate-50">
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white lg:static lg:min-h-svh lg:z-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } transition-transform duration-200 ease-out`}
      >
        <Sidebar onNavigate={() => setMobileOpen(false)} />
      </aside>
      {mobileOpen ? (
        <button
          type="button"
          className="no-print fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <div className="flex min-h-svh flex-1 flex-col lg:min-w-0">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </button>
          <span className="font-semibold text-slate-900">FormFlow</span>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 print:p-0">
          <div className="mx-auto max-w-5xl print:max-w-none">
            {showOfflineBanner ? (
              <div
                className="no-print mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                role="status"
              >
                <strong className="font-semibold">Not connected to Firestore.</strong> Submissions and
                invoices are stored only on this device. In Vercel, add all{' '}
                <code className="rounded bg-amber-100/90 px-1 text-xs">VITE_FIREBASE_*</code> variables
                (same values as <code className="rounded bg-amber-100/90 px-1 text-xs">.env.local</code>),
                then trigger a new deployment so the build can embed them.
              </div>
            ) : null}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function MenuIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
      />
    </svg>
  )
}
