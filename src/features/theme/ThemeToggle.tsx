import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const toggle = useThemeStore((s) => s.toggle)
  return (
    <button
      onClick={toggle}
      aria-label="Переключить тему"
      className="rounded-full p-2 hover:bg-elevated transition-colors"
      title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
    >
      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  )
}
