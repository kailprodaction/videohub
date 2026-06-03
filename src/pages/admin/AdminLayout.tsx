import { NavLink, Outlet } from 'react-router-dom'
import { Users, Tv, Video, MessageSquare, BarChart3, Megaphone, Wallet } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

const tabs = [
  { to: '/admin', label: 'Обзор', icon: BarChart3, end: true },
  { to: '/admin/users', label: 'Пользователи', icon: Users },
  { to: '/admin/channels', label: 'Каналы', icon: Tv },
  { to: '/admin/videos', label: 'Видео', icon: Video },
  { to: '/admin/comments', label: 'Комментарии', icon: MessageSquare },
  { to: '/admin/ads', label: 'Реклама', icon: Megaphone },
  { to: '/admin/finance', label: 'Финансы', icon: Wallet },
]

export function AdminLayout() {
  return (
    <div className="px-4 lg:px-8 py-6 max-w-[1600px] mx-auto">
      <h1 className="text-2xl font-bold mb-4">Админ-панель</h1>
      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors',
                isActive
                  ? 'border-brand text-brand'
                  : 'border-transparent text-muted hover:text-text',
              )
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  )
}
