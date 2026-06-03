import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Crown, Banknote, Shield, Wallet, Search } from 'lucide-react'
import {
  adminAdjustBalance,
  adminListPremiumUsers,
  adminSetPremium,
  adminTransactions,
} from '@/api/finance'
import { fetchChannels } from '@/api/channels'
import { fetchUsers } from '@/api/users'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Avatar } from '@/shared/ui/Avatar'
import { Loader } from '@/shared/ui/states'
import { toast } from '@/shared/ui/toast'
import { formatDate, formatNumber } from '@/shared/lib/format'
import type { Channel, Transaction, User } from '@/shared/types'

export function AdminFinancePage() {
  const [tab, setTab] = useState<'transactions' | 'balances' | 'premium'>('transactions')

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(
          [
            { v: 'transactions', label: 'Транзакции' },
            { v: 'balances', label: 'Балансы каналов' },
            { v: 'premium', label: 'Премиум' },
          ] as const
        ).map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={`px-3 h-9 rounded-lg text-sm font-medium ${
              tab === t.v ? 'bg-text text-bg' : 'bg-elevated hover:bg-border'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'transactions' && <TransactionsTable />}
      {tab === 'balances' && <BalancesTable />}
      {tab === 'premium' && <PremiumTable />}
    </div>
  )
}

function TransactionsTable() {
  const { data, isLoading } = useQuery({
    queryKey: ['transactions', 'admin'],
    queryFn: () => adminTransactions(),
  })
  if (isLoading) return <Loader />
  if (!data || data.length === 0)
    return <p className="text-sm text-muted">Транзакций пока нет.</p>
  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-elevated text-left">
          <tr>
            <th className="px-4 py-3">Тип</th>
            <th className="px-4 py-3">Описание</th>
            <th className="px-4 py-3">Сумма</th>
            <th className="px-4 py-3">Статус</th>
            <th className="px-4 py-3">Дата</th>
          </tr>
        </thead>
        <tbody>
          {data.map((t) => (
            <tr key={t.id} className="border-t border-border hover:bg-elevated/50">
              <td className="px-4 py-3"><TypeBadge t={t} /></td>
              <td className="px-4 py-3 text-muted max-w-md truncate">{t.description}</td>
              <td className="px-4 py-3 font-mono tabular-nums">
                {t.amount >= 0 ? '+' : ''}
                {formatNumber(t.amount)} ₸
              </td>
              <td className="px-4 py-3">
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-elevated">
                  {t.status}
                </span>
              </td>
              <td className="px-4 py-3 text-muted">{formatDate(t.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TypeBadge({ t }: { t: Transaction }) {
  const Icon = t.type === 'PREMIUM_PURCHASE' ? Crown : t.type === 'CHANNEL_PAYOUT' ? Banknote : Shield
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <Icon className="w-4 h-4 text-brand" />
      {t.type}
    </span>
  )
}

function BalancesTable() {
  const qc = useQueryClient()
  const { data: channels, isLoading } = useQuery({ queryKey: ['channels'], queryFn: fetchChannels })
  const [editing, setEditing] = useState<Channel | null>(null)

  if (isLoading) return <Loader />

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-elevated text-left">
            <tr>
              <th className="px-4 py-3">Канал</th>
              <th className="px-4 py-3">Баланс</th>
              <th className="px-4 py-3">Всего заработано</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {channels?.map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-elevated/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar src={c.avatarUrl} alt={c.name} size={32} />
                    <span className="font-medium">{c.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono tabular-nums">{formatNumber(c.balance ?? 0)} ₸</td>
                <td className="px-4 py-3 font-mono tabular-nums text-muted">
                  {formatNumber(c.totalEarned ?? 0)} ₸
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>
                    <Wallet className="w-4 h-4" />
                    Корректировать
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <BalanceEditor
          channel={editing}
          onClose={() => {
            setEditing(null)
            qc.invalidateQueries({ queryKey: ['channels'] })
            qc.invalidateQueries({ queryKey: ['transactions'] })
          }}
        />
      )}
    </div>
  )
}

function BalanceEditor({ channel, onClose }: { channel: Channel; onClose: () => void }) {
  const [amount, setAmount] = useState(0)
  const [comment, setComment] = useState('')
  const mut = useMutation({
    mutationFn: () => adminAdjustBalance(channel.id, amount, comment),
    onSuccess: () => {
      toast('Баланс изменён', 'success')
      onClose()
    },
    onError: () => toast('Ошибка изменения баланса', 'error'),
  })
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Баланс канала «{channel.name}»</h3>
        <p className="text-sm text-muted mb-3">
          Текущий баланс: <b>{formatNumber(channel.balance ?? 0)} ₸</b>
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Сумма (положительная — начислить, отрицательная — списать)</label>
            <Input type="number" value={amount} onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Комментарий</label>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Бонус / Штраф / ..." />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button onClick={() => mut.mutate()} disabled={amount === 0 || mut.isPending}>
            Применить
          </Button>
        </div>
      </div>
    </div>
  )
}

function PremiumTable() {
  const qc = useQueryClient()
  const { data: allUsers } = useQuery({ queryKey: ['users'], queryFn: fetchUsers })
  const { data: premiumUsers, isLoading } = useQuery({
    queryKey: ['users', 'premium'],
    queryFn: adminListPremiumUsers,
  })
  const [query, setQuery] = useState('')

  const grant = useMutation({
    mutationFn: (u: User) => adminSetPremium(u.id, { active: true, days: 30 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast('Премиум выдан на 30 дней', 'success')
    },
  })
  const revoke = useMutation({
    mutationFn: (u: User) => adminSetPremium(u.id, { active: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast('Премиум отозван', 'success')
    },
  })

  if (isLoading) return <Loader />

  const candidates =
    allUsers?.filter(
      (u) =>
        !u.premium &&
        (u.displayName.toLowerCase().includes(query.toLowerCase()) ||
          u.username.toLowerCase().includes(query.toLowerCase())),
    ) ?? []

  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-semibold mb-2">Пользователи с премиумом</h3>
        {!premiumUsers || premiumUsers.length === 0 ? (
          <p className="text-sm text-muted">Пока никого.</p>
        ) : (
          <div className="bg-surface border border-border rounded-2xl divide-y divide-border">
            {premiumUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar src={u.avatarUrl} alt={u.displayName} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{u.displayName}</div>
                  <div className="text-xs text-muted">
                    @{u.username} · до {u.premiumUntil ? formatDate(u.premiumUntil) : '—'}
                  </div>
                </div>
                <Button size="sm" variant="danger" onClick={() => revoke.mutate(u)}>
                  Отозвать
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-semibold mb-2">Выдать премиум</h3>
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени или логину…"
            className="pl-9"
          />
        </div>
        <div className="bg-surface border border-border rounded-2xl divide-y divide-border max-h-96 overflow-auto">
          {candidates.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar src={u.avatarUrl} alt={u.displayName} size={32} />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{u.displayName}</div>
                <div className="text-xs text-muted">@{u.username}</div>
              </div>
              <Button size="sm" onClick={() => grant.mutate(u)}>
                Выдать на 30 дней
              </Button>
            </div>
          ))}
          {candidates.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted">Ничего не найдено.</p>
          )}
        </div>
      </section>
    </div>
  )
}
