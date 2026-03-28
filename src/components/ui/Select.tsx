import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  error?: boolean
}

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { className = '', error, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={`w-full appearance-none rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${
        error ? 'border-red-300' : 'border-slate-200'
      } ${className}`}
      {...props}
    >
      {children}
    </select>
  )
})
