import { forwardRef } from 'react'
import type { TextareaHTMLAttributes } from 'react'

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(
  function Textarea({ className = '', error, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={4}
        className={`w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${
          error ? 'border-red-300' : 'border-slate-200'
        } ${className}`}
        {...props}
      />
    )
  },
)
