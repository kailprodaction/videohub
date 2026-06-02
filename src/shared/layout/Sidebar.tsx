import { NavLink } from 'react-router-dom'
import { Home, Users, ListVideo, BarChart3, Upload, ShieldCheck, User } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/shared/lib/cn'

interface SidebarProps {
  collapsed: boolean
}

const publicItems = [{ to: '/', label: 'Главная', icon: Home, end: true }]

const userItems = [
  { to: '/subscriptions', label: 'Подписки', icon: Users },
  { to: '/me', label: 'Личный кабинет', icon: User, end: true },
  { to: '/me/videos', label: 'Мой канал', icon: ListVideo },
  { to: '/me/upload', label: 'Загрузить', icon: Upload },
  { to: '/me/stats', label: 'Статистика', icon: BarChart3 },
]

const adminItems = [{ to: '/admin', label: 'Админ-панель', icon: ShieldCheck, end: true }]

export function Sidebar({ collapsed }: SidebarProps) {
  const user = useAuthStore((s) => s.user)
  const isAuthed = !!user
  const isAdmin = user?.role === 'admin'

  return (
    <aside
      className={cn(
        'sticky top-14 h-[calc(100vh-3.5rem)] bg-bg border-r border-border transition-all duration-200 overflow-y-auto',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <nav className="py-3">
        <Section items={publicItems} collapsed={collapsed} />
        {isAuthed && (
          <>
            <div className="my-2 border-t border-border" />
            <Section items={userItems} collapsed={collapsed} />
          </>
        )}
        {isAdmin && (
          <>
            <div className="my-2 border-t border-border" />
            <Section
              items={adminItems}
              collapsed={collapsed}
              title={collapsed ? undefined : 'Управление'}
            />
          </>
        )}
      </nav>
    </aside>
  )
}

function Section({
  items,
  collapsed,
  title,
}: {
  items: { to: string; label: string; icon: typeof Home; end?: boolean }[]
  collapsed: boolean
  title?: string
}) {
  return (
    <div className="px-2">
      {title && <h4 className="px-3 py-2 text-xs uppercase text-muted font-semibold">{title}</h4>}
      <ul className="space-y-1">
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-4 rounded-lg px-3 py-2 text-sm hover:bg-elevated',
                  isActive && 'bg-elevated font-medium',
                  collapsed && 'justify-center px-0',
                )
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
