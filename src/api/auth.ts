import { api } from './client'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/shared/types'

export interface AuthCodeResponse {
  email: string
  login: string
  expiresAt: string
  /** Только в демо-режиме AUTH_EXPOSE_CODE=true. */
  devCode?: string
}

export interface TokenResponse {
  token: string
  user: User
}

export function registerStart(payload: {
  email: string
  login: string
  displayName: string
  password: string
}) {
  return api<AuthCodeResponse>('/api/auth/register', { method: 'POST', body: payload })
}

export function registerVerify(email: string, code: string) {
  return api<TokenResponse>('/api/auth/register/verify', {
    method: 'POST',
    body: { email, code },
  }).then(persistSession)
}

export function login(loginName: string, password: string) {
  return api<TokenResponse>('/api/auth/login', {
    method: 'POST',
    body: { login: loginName, password },
  }).then(persistSession)
}

export function fetchMe() {
  return api<User>('/api/auth/me')
}

export function logout() {
  useAuthStore.getState().clear()
}

function persistSession(resp: TokenResponse): TokenResponse {
  useAuthStore.getState().setSession(resp.token, resp.user)
  return resp
}
