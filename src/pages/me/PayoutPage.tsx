import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Wallet, Banknote } from 'lucide-react'
import { myChannel, payout } from '@/api/finance'
import { ApiError } from '@/api/client'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { toast } from '@/shared/ui/toast'
import { formatNumber } from '@/shared/lib/format'

const schema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: 'Введите сумму' })
    .int('Только целые тенге')
    .positive('Сумма должна быть положительной'),
  cardNumber: z
    .string()
    .trim()
    .min(12, 'Минимум 12 цифр')
    .max(23, 'Слишком длинно')
    .regex(/^[\d ]+$/, 'Только цифры и пробелы'),
})

type FormValues = z.infer<typeof schema>

export function PayoutPage() {
  const qc = useQueryClient()
  const { data: channel } = useQuery({ queryKey: ['channel', 'me'], queryFn: myChannel })
  const [formError, setFormError] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const mut = useMutation({
    mutationFn: ({ amount, cardNumber }: FormValues) => payout(amount, cardNumber),
    onSuccess: (res) => {
      toast(res.message ?? 'Деньги отправлены на карту', 'success')
      qc.invalidateQueries({ queryKey: ['channel', 'me'] })
      qc.invalidateQueries({ queryKey: ['transactions', 'me'] })
      reset({ amount: 0, cardNumber: '' })
      setFormError('')
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

  const balance = channel?.balance ?? 0

  return (
    <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Вывод средств</h1>

      <div className="bg-surface border border-border rounded-2xl p-6 mb-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-elevated grid place-items-center text-brand">
          <Wallet className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs text-muted">Доступно к выводу</p>
          <p className="text-2xl font-bold">{formatNumber(balance)} ₸</p>
          {channel && (
            <p className="text-xs text-muted">
              Всего заработано за всё время: {formatNumber(channel.totalEarned ?? 0)} ₸
            </p>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit((data) => mut.mutate(data))}
        className="bg-surface border border-border rounded-2xl p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Сумма, ₸</label>
          <Input type="number" min={1} max={balance || undefined} {...register('amount')} />
          {errors.amount && <p className="text-danger text-xs mt-1">{errors.amount.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Номер карты</label>
          <Input
            placeholder="0000 0000 0000 0000"
            inputMode="numeric"
            autoComplete="cc-number"
            {...register('cardNumber')}
          />
          {errors.cardNumber && (
            <p className="text-danger text-xs mt-1">{errors.cardNumber.message}</p>
          )}
          <p className="text-xs text-muted mt-1">
            В базе сохраняются только последние 4 цифры карты.
          </p>
        </div>

        {formError && <p className="text-danger text-sm">{formError}</p>}

        <Button type="submit" className="w-full" disabled={mut.isPending}>
          <Banknote className="w-4 h-4" />
          {mut.isPending ? 'Отправка…' : 'Вывести на карту'}
        </Button>

        <p className="text-xs text-muted">
          Демо-режим. Реальные переводы не выполняются — создаётся транзакция CHANNEL_PAYOUT.
        </p>
      </form>
    </div>
  )
}
