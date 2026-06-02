// Тонкий HTTP-клиент поверх fetch.
// Базовый URL пуст — запросы идут на тот же origin, nginx проксирует /api на backend.
// Для локального dev (vite на 5173) можно задать VITE_API_BASE_URL=http://localhost:8080.

import { useAuthStore } from '@/stores/authStore'

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | null>
  signal?: AbortSignal
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = opts
  const headers: Record<string, string> = { Accept: 'application/json' }

  const token = useAuthStore.getState().token
  if (token) headers.Authorization = `Bearer ${token}`

  let init: RequestInit = { method, headers, signal }
  if (body !== undefined) {
    if (body instanceof FormData) {
      init.body = body
    } else {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
  }

  const url = new URL(BASE + path, window.location.origin)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }

  const res = await fetch(url.toString(), init)

  if (res.status === 401) {
    useAuthStore.getState().clear()
  }
  if (res.status === 204) {
    return undefined as T
  }
  const contentType = res.headers.get('Content-Type') ?? ''
  const isJSON = contentType.includes('application/json')
  if (!res.ok) {
    let code = 'http_error'
    let message = res.statusText
    if (isJSON) {
      try {
        const data = await res.json()
        if (data?.error) {
          code = data.error.code ?? code
          message = data.error.message ?? message
        }
      } catch {
        /* ignore */
      }
    }
    throw new ApiError(res.status, code, message)
  }
  if (!isJSON) return undefined as T
  return (await res.json()) as T
}
