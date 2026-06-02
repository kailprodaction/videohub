import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface AuthLayoutProps {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 shadow-sm">
        <Link to="/" className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-lg bg-brand grid place-items-center text-white font-bold">▶</div>
          <span className="font-semibold text-lg">VideoHub</span>
        </Link>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  )
}
