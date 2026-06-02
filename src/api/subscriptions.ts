import { api } from './client'
import type { Subscription } from '@/shared/types'

export function fetchSubscriptions(): Promise<Subscription[]> {
  return api<Subscription[]>('/api/subscriptions')
}

export async function isSubscribed(channelId: string): Promise<boolean> {
  try {
    const { subscribed } = await api<{ subscribed: boolean }>(
      `/api/channels/${channelId}/subscribed`,
    )
    return subscribed
  } catch {
    return false
  }
}

export async function subscribe(channelId: string): Promise<void> {
  await api(`/api/channels/${channelId}/subscribe`, { method: 'POST' })
}

export async function unsubscribe(channelId: string): Promise<void> {
  await api(`/api/channels/${channelId}/subscribe`, { method: 'DELETE' })
}
