import { create } from 'zustand'
import { useEffect } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

interface ToastItem {
  id: number
  message: string
  kind: 'success' | 'error'
}

interface ToastState {
  items: ToastItem[]
  show: (message: string, kind?: ToastItem['kind']) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  show: (message, kind = 'success') => {
    const id = nextId++
    set((s) => ({ items: [...s.items, { id, message, kind }] }))
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}))

export function toast(message: string, kind?: 'success' | 'error') {
  useToastStore.getState().show(message, kind)
}

export function ToastContainer() {
  const items = useToastStore((s) => s.items)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {items.map((t) => (
        <ToastView key={t.id} item={t} onClose={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastView({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onClose, 4000)
    return () => window.clearTimeout(t)
  }, [onClose])

  const Icon = item.kind === 'success' ? CheckCircle2 : AlertCircle
  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 max-w-sm pl-3 pr-2 py-2.5 rounded-xl border shadow-lg
        ${item.kind === 'success' ? 'bg-surface border-border' : 'bg-surface border-danger/50'}`}
    >
      <Icon className={`w-5 h-5 ${item.kind === 'success' ? 'text-green-500' : 'text-danger'}`} />
      <span className="text-sm flex-1">{item.message}</span>
      <button onClick={onClose} className="text-muted hover:text-text p-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
