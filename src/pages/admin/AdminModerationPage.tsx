import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, ShieldAlert, EyeOff, RefreshCw } from 'lucide-react'
import { fetchModerationQueue, setModerationStatus, rescanModeration } from '@/api/moderation'
import { Button } from '@/shared/ui/Button'
import { Loader, EmptyState } from '@/shared/ui/states'
import { timeAgo } from '@/shared/lib/format'
import type { ModerationRecord, ModerationStatus } from '@/shared/types'

const statusLabels: Record<ModerationStatus, string> = {
  approved: 'одобрено',
  pending: 'на модерации',
  blocked: 'заблокировано',
  shadow: 'теневой бан',
}

export function AdminModerationPage() {
  const qc = useQueryClient()
  const { data: queue, isLoading } = useQuery({
    queryKey: ['moderation', 'queue'],
    queryFn: fetchModerationQueue,
  })

  const decide = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ModerationStatus }) =>
      setModerationStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['moderation'] }),
  })
  const rescan = useMutation({
    mutationFn: (id: string) => rescanModeration(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['moderation'] }),
  })

  if (isLoading) return <Loader />
  if (!queue || queue.length === 0)
    return <EmptyState title="Очередь модерации пуста" message="Весь контент прошёл ML-проверку." />

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Видео, задержанные ML-классификатором или заблокированные. Скор ≥ 0.80 — авто-блок, 0.40–0.80 — ручная
        проверка.
      </p>
      {queue.map((m) => (
        <ModerationRow
          key={m.videoId}
          rec={m}
          onDecide={(status) => decide.mutate({ id: m.videoId, status })}
          onRescan={() => rescan.mutate(m.videoId)}
          busy={decide.isPending || rescan.isPending}
        />
      ))}
    </div>
  )
}

function ModerationRow({
  rec,
  onDecide,
  onRescan,
  busy,
}: {
  rec: ModerationRecord
  onDecide: (status: ModerationStatus) => void
  onRescan: () => void
  busy: boolean
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Link to={`/watch/${rec.videoId}`} className="font-semibold text-brand truncate max-w-[60%]">
          {rec.videoTitle || rec.videoId.slice(0, 8)}
        </Link>
        <span className="text-xs px-2 py-0.5 rounded-full bg-elevated">{statusLabels[rec.status]}</span>
        {rec.sanction !== 'none' && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-danger/15 text-danger">
            санкция: {rec.sanction}
          </span>
        )}
        <span className="text-xs text-muted ml-auto">{timeAgo(rec.createdAt)}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <ScoreBar label="Порно" value={rec.nudityScore} />
        <ScoreBar label="Насилие" value={rec.violenceScore} />
        <ScoreBar label="Копирайт" value={rec.copyrightScore} />
        <ScoreBar label="Спам" value={rec.spamScore} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">
          Общий риск: <b className={rec.overallScore >= 0.8 ? 'text-danger' : 'text-amber-500'}>
            {(rec.overallScore * 100).toFixed(0)}%
          </b>
        </span>
        {rec.labels.length > 0 && (
          <span className="text-xs text-muted">метки: {rec.labels.join(', ')}</span>
        )}
        <div className="flex gap-2 ml-auto">
          <Button size="sm" onClick={() => onDecide('approved')} disabled={busy}>
            <ShieldCheck className="w-4 h-4 mr-1" /> Одобрить
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDecide('shadow')} disabled={busy}>
            <EyeOff className="w-4 h-4 mr-1" /> Тень
          </Button>
          <Button size="sm" variant="danger" onClick={() => onDecide('blocked')} disabled={busy}>
            <ShieldAlert className="w-4 h-4 mr-1" /> Блок
          </Button>
          <Button size="sm" variant="ghost" onClick={onRescan} disabled={busy} title="Перепроверить ML">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  const color = value >= 0.8 ? 'bg-danger' : value >= 0.4 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted">{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-elevated overflow-hidden">
        <div className={'h-full ' + color} style={{ width: pct + '%' }} />
      </div>
    </div>
  )
}
