import { api } from './client'
import type { Channel, Transaction, User } from '@/shared/types'

export interface PremiumResult {
  user: User
  transaction: Transaction
  message: string
}

export function buyPremium(): Promise<PremiumResult> {
  return api<PremiumResult>('/api/premium/buy', { method: 'POST' })
}

export function adminSetPremium(
  userId: string,
  payload: { active: boolean; days?: number },
): Promise<User> {
  return api<User>(`/api/admin/users/${userId}/premium`, {
    method: 'PATCH',
    body: payload,
  })
}

export function adminListPremiumUsers(): Promise<User[]> {
  return api<User[]>('/api/admin/users/premium')
}

export function myTransactions(limit = 100): Promise<Transaction[]> {
  return api<Transaction[]>('/api/transactions/me', { query: { limit } })
}

export function adminTransactions(limit = 200): Promise<Transaction[]> {
  return api<Transaction[]>('/api/admin/transactions', { query: { limit } })
}

export function myChannel(): Promise<Channel> {
  return api<Channel>('/api/channels/me')
}

export interface PayoutResult {
  transaction: Transaction
  message: string
}

export function payout(amount: number, cardNumber: string): Promise<PayoutResult> {
  return api<PayoutResult>('/api/channels/me/payout', {
    method: 'POST',
    body: { amount, cardNumber },
  })
}

export function adminAdjustBalance(
  channelId: string,
  amount: number,
  comment: string,
): Promise<Transaction> {
  return api<Transaction>(`/api/admin/channels/${channelId}/balance`, {
    method: 'PATCH',
    body: { amount, comment },
  })
}
