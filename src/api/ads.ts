import { api, ApiError } from './client'
import type { Ad } from '@/shared/types'

/** Активная реклама для воспроизведения перед видео; null если рекламы нет. */
export async function fetchActiveAd(): Promise<Ad | null> {
  try {
    // Backend отдаёт 204 если активной рекламы нет → api() вернёт undefined.
    const ad = await api<Ad | undefined>('/api/ads/active')
    return ad ?? null
  } catch (e) {
    if (e instanceof ApiError && e.status === 204) return null
    return null
  }
}

export function adminListAds(): Promise<Ad[]> {
  return api<Ad[]>('/api/admin/ads')
}

export function adminCreateAd(input: {
  title: string
  description: string
  videoUrl: string
  active: boolean
}): Promise<Ad> {
  return api<Ad>('/api/admin/ads', { method: 'POST', body: input })
}

export async function adminUpdateAd(
  id: string,
  patch: Partial<{ title: string; description: string; videoUrl: string; active: boolean }>,
): Promise<void> {
  await api(`/api/admin/ads/${id}`, { method: 'PATCH', body: patch })
}

export async function adminDeleteAd(id: string): Promise<void> {
  await api(`/api/admin/ads/${id}`, { method: 'DELETE' })
}

export async function uploadAdFile(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const { url } = await api<{ url: string }>('/api/upload/ad', { method: 'POST', body: fd })
  return url
}
