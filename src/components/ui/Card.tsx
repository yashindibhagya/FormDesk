import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg'
}

const paddingMap = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({ children, className = '', padding = 'md' }: Props) {
  return (
    <div
      className={`rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-card)] ${paddingMap[padding]} ${className}`}
    >
      {children}
    </div>
  )
}
