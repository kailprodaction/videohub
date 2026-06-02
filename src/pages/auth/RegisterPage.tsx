import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '@/api/client'
import { registerStart, registerVerify } from '@/api/auth'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { AuthLayout } from './AuthLayout'

type Step = 'form' | 'code'

export function RegisterPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('form')

  const [email, setEmail] = useState('')
  const [loginValue, setLoginValue] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')

  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await registerStart({
        email: email.trim(),
        login: loginValue.trim(),
        displayName: displayName.trim(),
        password,
      })
      setDevCode(res.devCode)
      setStep('code')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось зарегистрироваться')
    } finally {
      setLoading(false)
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await registerVerify(email.trim(), code.trim())
      navigate('/')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Неверный код')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={step === 'form' ? 'Регистрация' : 'Подтвердите email'}
      subtitle={
        step === 'form'
          ? 'Заведите аккаунт с логином и паролем'
          : `Код подтверждения отправлен на ${email}. Действителен 10 минут.`
      }
      footer={
        <>
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-brand hover:underline">
            Войти
          </Link>
        </>
      }
    >
      {step === 'form' && (
        <form onSubmit={submitForm} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Имя</label>
            <Input
              required
              autoFocus
              maxLength={50}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Как вас называть"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Логин</label>
            <Input
              required
              pattern="[a-zA-Z0-9_-]{3,30}"
              minLength={3}
              maxLength={30}
              autoComplete="username"
              value={loginValue}
              onChange={(e) => setLoginValue(e.target.value)}
              placeholder="user123"
            />
            <p className="text-xs text-muted mt-1">
              3–30 символов: латиница, цифры, «_» или «-». Должен быть уникальным.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Пароль</label>
            <Input
              type="password"
              required
              minLength={6}
              maxLength={100}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="минимум 6 символов"
            />
          </div>
          {error && <p className="text-danger text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Отправка…' : 'Получить код'}
          </Button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={submitCode} className="space-y-4">
          {devCode && (
            <div className="bg-elevated border border-border rounded-lg p-3 text-sm">
              <div className="font-medium">Демо-режим</div>
              <div className="text-muted">
                Письма не отправляются. Ваш код:{' '}
                <span className="font-mono text-brand text-lg">{devCode}</span>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Код подтверждения</label>
            <Input
              inputMode="numeric"
              pattern="\d{6}"
              required
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="text-center text-lg tracking-widest font-mono"
            />
          </div>
          {error && <p className="text-danger text-sm">{error}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={() => {
                setStep('form')
                setCode('')
                setError('')
              }}
            >
              Назад
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Создание…' : 'Создать аккаунт'}
            </Button>
          </div>
        </form>
      )}
    </AuthLayout>
  )
}
