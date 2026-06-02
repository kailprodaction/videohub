import { api } from './client'
import type { ChannelStats, PlatformStats } from '@/shared/types'

export async function getChannelStats(channelId: string): Promise<ChannelStats | null> {
  try {
    return await api<ChannelStats>(`/api/channels/${channelId}/stats`)
  } catch {
    return null
  }
}

export function getPlatformStats(): Promise<PlatformStats> {
  return api<PlatformStats>('/api/admin/stats')
}
