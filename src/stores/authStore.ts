import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/shared/types'

interface AuthState {
  token: string | null
  user: User | null
  setSession: (token: string, user: User) => void
  setUser: (user: User) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      clear: () => set({ token: null, user: null }),
    }),
    { name: 'vh:auth' },
  ),
)

export function useIsAuthenticated() {
  return useAuthStore((s) => !!s.token && !!s.user)
}

export function useIsAdmin() {
  return useAuthStore((s) => s.user?.role === 'admin')
}
