import type { ReactNode } from 'react'

type Props = {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  children: ReactNode
  required?: boolean
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  children,
  required,
}: Props) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
