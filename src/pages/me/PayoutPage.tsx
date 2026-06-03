import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, CreditCard, ShieldCheck, Wallet } from 'lucide-react'
import { myChannel, payout } from '@/api/finance'
import { ApiError } from '@/api/client'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { toast } from '@/shared/ui/toast'
import { formatNumber } from '@/shared/lib/format'
import {
  cardBrandLabel,
  formatCardNumber,
  formatCvc,
  formatExpiry,
  validateCard,
  type CardBrand,
} from '@/shared/lib/card'

export function PayoutPage() {
  const qc = useQueryClient()
  const { data: channel } = useQuery({ queryKey: ['channel', 'me'], queryFn: myChannel })
  const [amount, setAmount] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [formError, setFormError] = useState('')
  const [touched, setTouched] = useState(false)

  const card = useMemo(() => validateCard(cardNumber, expiry, cvc), [cardNumber, expiry, cvc])
  const balance = channel?.balance ?? 0
  const amountValue = Number(amount)
  const amountError = getAmountError(amount, balance)
  const showErrors = touched || card.cardDigits.length > 0 || expiry.length > 0 || cvc.length > 0

  const mut = useMutation({
    mutationFn: () => payout(amountValue, card.cardDigits, expiry, card.cvcDigits, card.brand as 'visa' | 'mastercard'),
    onSuccess: (res) => {
      toast(res.message ?? 'Деньги отправлены на карту', 'success')
      qc.invalidateQueries({ queryKey: ['channel', 'me'] })
      qc.invalidateQueries({ queryKey: ['transactions', 'me'] })
      setAmount('')
      setCardNumber('')
      setExpiry('')
      setCvc('')
      setFormError('')
      setTouched(false)
    },
    onError: (e) => {
      const msg =
        e instanceof ApiError && e.code === 'insufficient_funds'
          ? 'Недостаточно средств на балансе канала'
          : e instanceof ApiError
            ? e.message
            : 'Не удалось выполнить вывод'
      setFormError(msg)
      toast(msg, 'error')
    },
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    setFormError('')
    if (amountError || !card.isValid || card.brand === 'unknown') return
    mut.mutate()
  }

  return (
    <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Вывод средств</h1>

      <div className="grid lg:grid-cols-[1fr_420px] gap-6 items-start">
        <div className="bg-surface border border-border rounded-2xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-elevated grid place-items-center text-brand">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted">Доступно к выводу</p>
            <p className="text-2xl font-bold">{formatNumber(balance)} ₸</p>
            {channel && (
              <p className="text-xs text-muted">
                Всего заработано за все время: {formatNumber(channel.totalEarned ?? 0)} ₸
              </p>
            )}
          </div>
        </div>

        <form onSubmit={submit} className="bg-surface border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted">Перевод на карту</p>
              <p className="text-2xl font-bold">{amountValue > 0 ? formatNumber(amountValue) : 0} ₸</p>
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
              <span>•••</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Сумма, ₸</label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 10))}
              onBlur={() => setTouched(true)}
              placeholder="0"
              inputMode="numeric"
            />
            {touched && amountError && <p className="text-danger text-xs mt-1">{amountError}</p>}
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

          <div className="flex items-center gap-2 text-xs text-muted">
            <ShieldCheck className="w-4 h-4 text-brand" />
            В базе сохраняются только последние 4 цифры карты.
          </div>

          {formError && <p className="text-danger text-sm">{formError}</p>}

          <Button type="submit" className="w-full" disabled={mut.isPending || !!amountError || !card.isValid}>
            <Banknote className="w-4 h-4" />
            {mut.isPending ? 'Отправка...' : 'Вывести на карту'}
          </Button>

          <p className="text-xs text-muted">
            Демо-режим: реальные переводы не выполняются, создается транзакция CHANNEL_PAYOUT.
          </p>
        </form>
      </div>
    </div>
  )
}

function getAmountError(amount: string, balance: number) {
  if (!amount) return 'Введите сумму'
  const value = Number(amount)
  if (!Number.isInteger(value) || value <= 0) return 'Сумма должна быть положительной'
  if (balance > 0 && value > balance) return 'Сумма больше баланса канала'
  return ''
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
