import { useEffect } from 'react'
import { useThemeStore } from '@/stores/themeStore'

export function ThemeBootstrap() {
  const theme = useThemeStore((s) => s.theme)
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [theme])
  return null
}
