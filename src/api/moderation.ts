import { api } from './client'
import type { ModerationRecord, ModerationStatus, ModerationVerdict } from '@/shared/types'

export function fetchModerationQueue(): Promise<ModerationRecord[]> {
  return api<ModerationRecord[]>('/api/admin/moderation')
}

export function setModerationStatus(
  videoId: string,
  status: ModerationStatus,
  sanction = 'none',
): Promise<void> {
  return api(`/api/admin/videos/${videoId}/moderation`, {
    method: 'POST',
    body: { status, sanction },
  })
}

export function rescanModeration(
  videoId: string,
): Promise<{ status: ModerationStatus; moderation: ModerationVerdict }> {
  return api(`/api/admin/videos/${videoId}/moderation/rescan`, { method: 'POST' })
}
