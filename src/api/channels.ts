import { api } from './client'
import type { Channel } from '@/shared/types'

export function fetchChannels(): Promise<Channel[]> {
  return api<Channel[]>('/api/channels')
}

export async function getChannelById(id: string): Promise<Channel | null> {
  try {
    return await api<Channel>(`/api/channels/${id}`)
  } catch {
    return null
  }
}

export async function getChannelByOwner(ownerId: string): Promise<Channel | null> {
  try {
    return await api<Channel>(`/api/channels/by-owner/${ownerId}`)
  } catch {
    return null
  }
}

export async function updateChannelStats(): Promise<void> {
  // Не используется напрямую — админ-форма зовёт api/admin/channels/:id/stats.
}

export async function updateChannelProfile(
  channelId: string,
  patch: Partial<Pick<Channel, 'name' | 'description' | 'avatarUrl'>>,
): Promise<void> {
  await api(`/api/channels/${channelId}`, { method: 'PATCH', body: patch })
}

export async function adminAdjustChannelStats(
  channelId: string,
  patch: { viewsDelta?: number; likesDelta?: number; dislikesDelta?: number; subscribersDelta?: number },
): Promise<void> {
  await api(`/api/admin/channels/${channelId}/stats`, { method: 'POST', body: patch })
}
