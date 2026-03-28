import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
    isActive
      ? 'bg-blue-50 text-blue-700'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`

type Props = {
  onNavigate?: () => void
}

export function Sidebar({ onNavigate }: Props) {
  const { user, signOutUser } = useAuth()
  const { pathname } = useLocation()
  const quotationsNavActive = pathname === '/quotations' || pathname === '/quotation' || /^\/quotation\/.+/.test(pathname)
  const invoicesNavActive = pathname === '/invoices' || pathname === '/invoice' || /^\/invoice\/.+/.test(pathname)

  return (
    <nav className="flex h-full min-h-0 flex-col gap-1 p-4" aria-label="Main">
      <div className="mb-6 px-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          FormFlow
        </p>
        <p className="mt-1 text-lg font-semibold text-slate-900">Dashboard</p>
      </div>
      <NavLink to="/" end className={linkClass} onClick={onNavigate}>
        <LayoutGridIcon />
        Dashboard
      </NavLink>
      <NavLink to="/survey" className={linkClass} onClick={onNavigate}>
        <PenIcon />
        New survey
      </NavLink>
      <NavLink
        to="/quotations"
        className={({ isActive }) => linkClass({ isActive: isActive || quotationsNavActive })}
        onClick={onNavigate}
      >
        <DocIcon />
        Quotations
      </NavLink>
      <NavLink
        to="/invoices"
        className={({ isActive }) => linkClass({ isActive: isActive || invoicesNavActive })}
        onClick={onNavigate}
      >
        <ReceiptIcon />
        Invoices
      </NavLink>

      {user ? (
        <div className="mt-auto border-t border-slate-100 pt-4">
          <p className="mb-2 truncate px-3 text-xs text-slate-500" title={user.email ?? undefined}>
            {user.email}
          </p>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            onClick={() => {
              void signOutUser()
              onNavigate?.()
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </nav>
  )
}

function LayoutGridIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0 opacity-70"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75A2.25 2.25 0 0115.75 18h2.25A2.25 2.25 0 0120.25 15.75v-2.25A2.25 2.25 0 0118 11.25h-2.25a2.25 2.25 0 00-2.25 2.25v2.25zM13.5 6A2.25 2.25 0 0115.75 3.75h2.25A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 00-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25z"
      />
    </svg>
  )
}

function DocIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0 opacity-70"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  )
}

function PenIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0 opacity-70"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
      />
    </svg>
  )
}

function ReceiptIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0 opacity-70"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  )
}
