import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

interface RequireAuthProps {
  children: ReactNode
  /** Если true — кроме входа требуется ещё и роль admin. */
  admin?: boolean
}

export function RequireAuth({ children, admin }: RequireAuthProps) {
  const location = useLocation()
  const { token, user } = useAuthStore()
  if (!token || !user) {
    const target = admin ? '/admin/login' : '/login'
    return <Navigate to={target} state={{ from: location.pathname }} replace />
  }
  if (admin && user.role !== 'admin') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
