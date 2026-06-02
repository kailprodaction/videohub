import { AlertCircle, Inbox, Loader2 } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

export function Loader({ label = 'Загрузка…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 text-muted py-12', className)}>
      <Loader2 className="w-5 h-5 animate-spin" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorState({
  title = 'Что-то пошло не так',
  message = 'Не удалось загрузить данные. Попробуйте обновить страницу.',
  onRetry,
}: {
  title?: string
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 gap-3 text-muted">
      <AlertCircle className="w-10 h-10 text-danger" />
      <h3 className="font-medium text-text">{title}</h3>
      <p className="max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded-lg px-4 py-2 bg-brand text-white hover:bg-brandHover text-sm font-medium"
        >
          Повторить
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  title = 'Пока пусто',
  message = 'Здесь пока ничего нет.',
  icon,
}: {
  title?: string
  message?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 gap-3 text-muted">
      {icon ?? <Inbox className="w-10 h-10" />}
      <h3 className="font-medium text-text">{title}</h3>
      <p className="max-w-md">{message}</p>
    </div>
  )
}

export function VideoCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="skeleton aspect-video rounded-xl" />
      <div className="flex gap-3">
        <div className="skeleton w-9 h-9 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 rounded w-3/4" />
          <div className="skeleton h-3 rounded w-1/2" />
        </div>
      </div>
    </div>
  )
}
