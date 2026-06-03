import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Crown, CreditCard, LockKeyhole, ShieldCheck, Sparkles, X } from 'lucide-react'
import { buyPremium, type CardPaymentPayload } from '@/api/finance'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { toast } from '@/shared/ui/toast'
import { formatDate, formatNumber } from '@/shared/lib/format'
import {
  cardBrandLabel,
  formatCardNumber,
  formatCvc,
  formatExpiry,
  validateCard,
  type CardBrand,
} from '@/shared/lib/card'

const PREMIUM_PRICE = 990
const PREMIUM_DAYS = 30

export function PremiumPage() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [touched, setTouched] = useState(false)

  const card = useMemo(() => validateCard(cardNumber, expiry, cvc), [cardNumber, expiry, cvc])

  const buy = useMutation({
    mutationFn: (payload: CardPaymentPayload) => buyPremium(payload),
    onSuccess: (res) => {
      setUser(res.user)
      qc.invalidateQueries({ queryKey: ['transactions', 'me'] })
      toast(res.message ?? 'Премиум активирован', 'success')
    },
    onError: () => toast('Не удалось активировать премиум', 'error'),
  })

  const isPremium = user?.premium === true
  const until = user?.premiumUntil ? new Date(user.premiumUntil) : null
  const showErrors = touched || card.cardDigits.length > 0 || expiry.length > 0 || cvc.length > 0

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!card.isValid || card.brand === 'unknown') return
    buy.mutate({
      cardNumber: card.cardDigits,
      expiry,
      cvc: card.cvcDigits,
      brand: card.brand,
    })
  }

  return (
    <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Премиум</h1>

      <div className="grid lg:grid-cols-[1fr_420px] gap-6 items-start">
        <section className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-brand/15 text-brand grid place-items-center">
              {isPremium ? <Crown className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {isPremium ? 'Премиум активен' : 'Подключите премиум'}
              </h2>
              {isPremium && until && (
                <p className="text-sm text-muted">Действует до {formatDate(until.toISOString())}</p>
              )}
              {!isPremium && (
                <p className="text-sm text-muted">{formatNumber(PREMIUM_PRICE)} ₸ за {PREMIUM_DAYS} дней</p>
              )}
            </div>
          </div>

          <ul className="space-y-2 mt-4 text-sm">
            <Feature on={isPremium}>Видео без рекламы перед просмотром</Feature>
            <Feature on={isPremium}>Поддержка авторов</Feature>
            <Feature on={isPremium}>Доступ к будущим эксклюзивным функциям</Feature>
          </ul>

          {isPremium ? (
            <p className="text-sm text-muted mt-6">
              Чтобы отключить премиум, обратитесь к администратору.
            </p>
          ) : (
            <div className="mt-6 flex items-center gap-2 text-xs text-muted">
              <ShieldCheck className="w-4 h-4 text-brand" />
              В системе сохраняются только последние 4 цифры карты.
            </div>
          )}
        </section>

        {!isPremium && (
          <form onSubmit={submit} className="bg-surface border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted">Оплата картой</p>
                <p className="text-2xl font-bold">{formatNumber(PREMIUM_PRICE)} ₸</p>
              </div>
              <BrandBadge brand={card.brand} />
            </div>

            <div className="rounded-xl border border-border bg-elevated p-4">
              <div className="flex items-center justify-between mb-8">
                <CreditCard className="w-6 h-6 text-muted" />
                <span className="text-sm font-semibold uppercase">{cardBrandLabel(card.brand)}</span>
              </div>
              <p className="font-mono text-lg tracking-normal">
                {cardNumber || '0000 0000 0000 0000'}
              </p>
              <div className="flex justify-between mt-4 text-xs text-muted">
                <span>{expiry || 'MM/YY'}</span>
                <span>CVC</span>
              </div>
            </div>

            <Field label="Номер карты" error={showErrors ? card.cardError : ''}>
              <Input
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                onBlur={() => setTouched(true)}
                placeholder="0000 0000 0000 0000"
                inputMode="numeric"
                autoComplete="cc-number"
                maxLength={19}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Срок" error={showErrors ? card.expiryError : ''}>
                <Input
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  onBlur={() => setTouched(true)}
                  placeholder="MM/YY"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  maxLength={5}
                />
              </Field>
              <Field label="CVC" error={showErrors ? card.cvcError : ''}>
                <Input
                  value={cvc}
                  onChange={(e) => setCvc(formatCvc(e.target.value))}
                  onBlur={() => setTouched(true)}
                  placeholder="123"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  maxLength={3}
                />
              </Field>
            </div>

            <Button type="submit" className="w-full" disabled={buy.isPending || !card.isValid}>
              <LockKeyhole className="w-4 h-4" />
              {buy.isPending ? 'Покупка...' : `Купить за ${PREMIUM_PRICE} ₸`}
            </Button>

            <p className="text-xs text-muted">
              Демо-режим: реальные платежи не проводятся, создается успешная транзакция.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

function Feature({ children, on }: { children: React.ReactNode; on: boolean }) {
  return (
    <li className="flex items-center gap-2">
      {on ? (
        <Sparkles className="w-4 h-4 text-brand" />
      ) : (
        <X className="w-4 h-4 text-muted" />
      )}
      <span className={on ? 'text-text' : 'text-muted'}>{children}</span>
    </li>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
      {error && <p className="text-danger text-xs mt-1">{error}</p>}
    </div>
  )
}

function BrandBadge({ brand }: { brand: CardBrand }) {
  const styles =
    brand === 'visa'
      ? 'bg-blue-600 text-white'
      : brand === 'mastercard'
        ? 'bg-amber-500 text-black'
        : 'bg-elevated text-muted border border-border'

  return (
    <div className={`h-9 px-3 rounded-lg grid place-items-center text-xs font-bold uppercase ${styles}`}>
      {cardBrandLabel(brand)}
    </div>
  )
}
