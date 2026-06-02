import { Link } from 'react-router-dom'
import { Button } from '@/shared/ui/Button'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <h1 className="text-6xl font-bold text-brand">404</h1>
      <p className="text-muted">Страница не найдена</p>
      <Link to="/">
        <Button>На главную</Button>
      </Link>
    </div>
  )
}
