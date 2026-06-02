import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Minus, Save } from 'lucide-react'
import { adminAdjustChannelStats } from '@/api/channels'
import { Button } from '@/shared/ui/Button'

interface AdminStatsFormProps {
  channelId: string
  onClose: () => void
}

type Field = 'subscribers' | 'views' | 'likes' | 'dislikes'

const fields: { key: Field; label: string }[] = [
  { key: 'subscribers', label: 'Подписчики' },
  { key: 'views', label: 'Просмотры' },
  { key: 'likes', label: 'Лайки' },
  { key: 'dislikes', label: 'Дизлайки' },
]

export function AdminStatsForm({ channelId, onClose }: AdminStatsFormProps) {
  const qc = useQueryClient()
  const [deltas, setDeltas] = useState<Record<Field, number>>({
    subscribers: 0,
    views: 0,
    likes: 0,
    dislikes: 0,
  })

  function bump(field: Field, amount: number) {
    setDeltas((d) => ({ ...d, [field]: d[field] + amount }))
  }

  function set(field: Field, value: number) {
    setDeltas((d) => ({ ...d, [field]: Number.isFinite(value) ? value : 0 }))
  }

  const save = useMutation({
    mutationFn: () =>
      adminAdjustChannelStats(channelId, {
        subscribersDelta: deltas.subscribers,
        viewsDelta: deltas.views,
        likesDelta: deltas.likes,
        dislikesDelta: deltas.dislikes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channel', channelId] })
      qc.invalidateQueries({ queryKey: ['channels'] })
      qc.invalidateQueries({ queryKey: ['stats', channelId] })
      qc.invalidateQueries({ queryKey: ['videos'] })
      qc.invalidateQueries({ queryKey: ['video'] })
      setDeltas({ subscribers: 0, views: 0, likes: 0, dislikes: 0 })
      onClose()
    },
  })

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <h4 className="font-semibold mb-4">Изменить статистику канала</h4>
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center gap-2">
            <label className="w-32 text-sm">{f.label}</label>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="secondary" onClick={() => bump(f.key, -10)}>
                <Minus className="w-3 h-3" />10
              </Button>
              <Button size="sm" variant="secondary" onClick={() => bump(f.key, -1)}>
                <Minus className="w-3 h-3" />
              </Button>
              <input
                type="number"
                value={deltas[f.key]}
                onChange={(e) => set(f.key, parseInt(e.target.value, 10))}
                className="w-24 h-8 px-2 text-sm rounded border border-border bg-bg text-center"
              />
              <Button size="sm" variant="secondary" onClick={() => bump(f.key, 1)}>
                <Plus className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="secondary" onClick={() => bump(f.key, 10)}>
                <Plus className="w-3 h-3" />10
              </Button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted mt-3">
        Положительные числа — добавить, отрицательные — убавить. Изменения суммируются.
      </p>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="ghost" onClick={onClose}>
          Отмена
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="w-4 h-4" />
          Сохранить изменения
        </Button>
      </div>
    </div>
  )
}
