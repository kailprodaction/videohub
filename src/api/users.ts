import { api } from './client'
import type { User } from '@/shared/types'

export function fetchUsers(): Promise<User[]> {
  return api<User[]>('/api/users')
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    return await api<User>(`/api/users/${id}`)
  } catch {
    return null
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    return await api<User>('/api/auth/me')
  } catch {
    return null
  }
}

export async function updateProfile(
  patch: Partial<Pick<User, 'displayName' | 'bio' | 'avatarUrl'>>,
): Promise<void> {
  await api('/api/users/me', { method: 'PATCH', body: patch })
}

export async function blockUser(id: string, blocked: boolean): Promise<void> {
  await api(`/api/admin/users/${id}/block`, { method: 'POST', body: { blocked } })
}
