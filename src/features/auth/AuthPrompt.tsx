import { create } from 'zustand'
import { Link } from 'react-router-dom'
import { LogIn, UserPlus } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

interface AuthPromptState {
  open: boolean
  message: string
  openWith: (message: string) => void
  close: () => void
}

const useAuthPromptStore = create<AuthPromptState>((set) => ({
  open: false,
  message: '',
  openWith: (message) => set({ open: true, message }),
  close: () => set({ open: false }),
}))

/**
 * requireAuth — обёртка для защищённых действий.
 * Если пользователь не залогинен — открывает модалку «зарегистрируйтесь» и
 * возвращает false. Если залогинен — возвращает true (можно выполнять action).
 */
export function requireAuth(message: string): boolean {
  const { token, user } = useAuthStore.getState()
  if (token && user) return true
  useAuthPromptStore.getState().openWith(message)
  return false
}

/**
 * AuthPromptDialog рендерится один раз на корневом уровне (в RootLayout).
 * Показывает оверлей с предложением войти или зарегистрироваться.
 */
export function AuthPromptDialog() {
  const { open, message, close } = useAuthPromptStore()
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
      onClick={close}
    >
      <div
        className="w-full max-w-sm bg-surface border border-border rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-brand/15 grid place-items-center text-brand">
            <UserPlus className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-lg">Нужен аккаунт</h3>
        </div>
        <p className="text-sm text-muted mb-5">{message}</p>
        <div className="flex flex-col gap-2">
          <Link
            to="/register"
            onClick={close}
            className="inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brandHover transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Зарегистрироваться
          </Link>
          <Link
            to="/login"
            onClick={close}
            className="inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-elevated text-text text-sm font-medium hover:bg-border transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Войти
          </Link>
          <button
            type="button"
            onClick={close}
            className="h-10 rounded-lg text-sm text-muted hover:text-text"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}
