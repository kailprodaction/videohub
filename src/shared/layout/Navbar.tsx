import { useState, type FormEvent } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { LogIn, LogOut, Menu, Search, ShieldCheck, Upload, User as UserIcon } from 'lucide-react'
import { logout } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import { Avatar } from '@/shared/ui/Avatar'
import { ThemeToggle } from '@/features/theme/ThemeToggle'

interface NavbarProps {
  onMenuClick: () => void
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  function onLogout() {
    logout()
    setMenuOpen(false)
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-40 bg-bg border-b border-border">
      <div className="h-14 flex items-center gap-2 px-4">
        <button onClick={onMenuClick} className="p-2 rounded-full hover:bg-elevated" aria-label="Меню">
          <Menu className="w-5 h-5" />
        </button>

        <Link to="/" className="flex items-center gap-2 mr-2">
          <div className="w-8 h-8 rounded-lg bg-brand grid place-items-center text-white font-bold">▶</div>
          <span className="hidden sm:inline font-semibold text-lg">VideoHub</span>
        </Link>

        <form onSubmit={onSearch} className="flex-1 max-w-2xl mx-auto flex items-center">
          <input
            type="text"
            placeholder="Поиск"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 w-full rounded-l-full border border-border bg-surface px-4 text-sm focus:outline-none focus:border-brand"
          />
          <button
            type="submit"
            className="h-10 px-5 border border-l-0 border-border bg-elevated rounded-r-full hover:bg-border"
            aria-label="Найти"
          >
            <Search className="w-4 h-4" />
          </button>
        </form>

        <div className="flex items-center gap-1 ml-auto">
          {user && (
            <Link
              to="/me/upload"
              className="hidden sm:flex items-center gap-2 rounded-full px-3 h-9 hover:bg-elevated text-sm"
              title="Загрузить видео"
            >
              <Upload className="w-5 h-5" />
              <span className="hidden md:inline">Загрузить</span>
            </Link>
          )}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `hidden sm:flex items-center gap-2 rounded-full px-3 h-9 hover:bg-elevated text-sm ${
                  isActive ? 'text-brand' : ''
                }`
              }
              title="Админ-панель"
            >
              <ShieldCheck className="w-5 h-5" />
              <span className="hidden md:inline">Админ</span>
            </NavLink>
          )}
          <ThemeToggle />

          {user ? (
            <div className="relative ml-1">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
                title={user.displayName}
                className="block"
              >
                <Avatar src={user.avatarUrl} alt={user.displayName} size={32} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-border rounded-xl shadow-lg p-1 z-50">
                  <div className="px-3 py-2 border-b border-border">
                    <div className="font-medium text-sm truncate">{user.displayName}</div>
                    <div className="text-xs text-muted truncate">{user.email}</div>
                  </div>
                  <Link
                    to="/me"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-elevated text-sm"
                  >
                    <UserIcon className="w-4 h-4" /> Личный кабинет
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-elevated text-sm"
                    >
                      <ShieldCheck className="w-4 h-4" /> Админ-панель
                    </Link>
                  )}
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-elevated text-sm text-left text-danger"
                  >
                    <LogOut className="w-4 h-4" /> Выйти
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-2 rounded-full px-3 h-9 hover:bg-elevated text-sm font-medium border border-border"
            >
              <LogIn className="w-4 h-4" />
              <span>Войти</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
