import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className = '', error, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${
        error ? 'border-red-300' : 'border-slate-200'
      } ${className}`}
      {...props}
    />
  )
})
