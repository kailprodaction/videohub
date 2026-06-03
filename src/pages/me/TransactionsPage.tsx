import { useQuery } from '@tanstack/react-query'
import { Crown, Banknote, Shield } from 'lucide-react'
import { myTransactions } from '@/api/finance'
import { EmptyState, Loader } from '@/shared/ui/states'
import { formatDate, formatNumber } from '@/shared/lib/format'
import type { Transaction, TransactionType } from '@/shared/types'

const typeLabels: Record<TransactionType, string> = {
  PREMIUM_PURCHASE: 'Покупка премиума',
  CHANNEL_PAYOUT: 'Вывод средств',
  ADMIN_ADJUSTMENT: 'Корректировка администратором',
}

const typeIcons: Record<TransactionType, typeof Crown> = {
  PREMIUM_PURCHASE: Crown,
  CHANNEL_PAYOUT: Banknote,
  ADMIN_ADJUSTMENT: Shield,
}

export function TransactionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['transactions', 'me'],
    queryFn: () => myTransactions(),
  })

  if (isLoading) return <Loader />
  if (!data || data.length === 0)
    return (
      <div className="py-10">
        <EmptyState
          title="Транзакций пока нет"
          message="Здесь появятся покупки премиума, выводы средств и корректировки."
        />
      </div>
    )

  return (
    <div className="px-4 lg:px-8 py-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Транзакции</h1>
      <ul className="space-y-2">
        {data.map((t) => (
          <TransactionRow key={t.id} t={t} />
        ))}
      </ul>
    </div>
  )
}

function TransactionRow({ t }: { t: Transaction }) {
  const Icon = typeIcons[t.type] ?? Crown
  const sign = t.type === 'CHANNEL_PAYOUT' ? '−' : t.amount < 0 ? '−' : '+'
  return (
    <li className="bg-surface border border-border rounded-2xl px-4 py-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-elevated grid place-items-center text-brand">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{typeLabels[t.type]}</span>
          <StatusBadge status={t.status} />
        </div>
        <p className="text-xs text-muted truncate">{t.description}</p>
        <p className="text-xs text-muted">{formatDate(t.createdAt)}</p>
      </div>
      <div className="font-mono tabular-nums text-sm">
        {sign}
        {formatNumber(Math.abs(t.amount))} ₸
      </div>
    </li>
  )
}

function StatusBadge({ status }: { status: Transaction['status'] }) {
  const styles =
    status === 'SUCCESS'
      ? 'bg-green-500/15 text-green-600 dark:text-green-400'
      : status === 'FAILED'
        ? 'bg-danger/15 text-danger'
        : 'bg-elevated text-muted'
  return <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${styles}`}>{status}</span>
}
