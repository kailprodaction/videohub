import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '@/api/client'
import { login } from '@/api/auth'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { AuthLayout } from './AuthLayout'

export function LoginPage() {
  const navigate = useNavigate()
  const [loginValue, setLoginValue] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(loginValue.trim(), password)
      navigate('/')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось войти')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Вход"
      subtitle="Введите логин и пароль"
      footer={
        <>
          Нет аккаунта?{' '}
          <Link to="/register" className="text-brand hover:underline">
            Зарегистрироваться
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Логин</label>
          <Input
            required
            autoFocus
            autoComplete="username"
            value={loginValue}
            onChange={(e) => setLoginValue(e.target.value)}
            placeholder="Логин"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Пароль</label>
          <Input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
          />
        </div>
        {error && <p className="text-danger text-sm">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Вход…' : 'Войти'}
        </Button>
      </form>
    </AuthLayout>
  )
}
