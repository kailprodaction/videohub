import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Crown, Sparkles, X } from 'lucide-react'
import { buyPremium } from '@/api/finance'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/shared/ui/Button'
import { toast } from '@/shared/ui/toast'
import { formatDate, formatNumber } from '@/shared/lib/format'

const PREMIUM_PRICE = 990
const PREMIUM_DAYS = 30

export function PremiumPage() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const buy = useMutation({
    mutationFn: buyPremium,
    onSuccess: (res) => {
      setUser(res.user)
      qc.invalidateQueries({ queryKey: ['transactions', 'me'] })
      toast(res.message ?? 'Премиум активирован', 'success')
    },
    onError: () => toast('Не удалось активировать премиум', 'error'),
  })

  const isPremium = user?.premium === true
  const until = user?.premiumUntil ? new Date(user.premiumUntil) : null

  return (
    <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Премиум</h1>

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

        <div className="mt-6 flex justify-end gap-2">
          {isPremium ? (
            <p className="text-sm text-muted self-center">
              Чтобы отключить премиум, обратитесь к администратору.
            </p>
          ) : (
            <Button onClick={() => buy.mutate()} disabled={buy.isPending}>
              {buy.isPending ? 'Покупка…' : `Купить за ${PREMIUM_PRICE} ₸`}
            </Button>
          )}
        </div>

        <p className="text-xs text-muted mt-4">
          Демо-режим. Реальные платежи не проводятся: транзакция фиксируется в системе как успешная.
        </p>
      </section>
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
