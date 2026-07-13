import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Flag, Check, X, Eye } from 'lucide-react'
import { fetchReports, resolveReport } from '@/api/reports'
import { Button } from '@/shared/ui/Button'
import { Loader, EmptyState } from '@/shared/ui/states'
import { timeAgo } from '@/shared/lib/format'
import type { Report, ReportReason, ReportStatus } from '@/shared/types'

const reasonLabels: Record<ReportReason, string> = {
  spam: 'Спам',
  nudity: 'Порнография 18+',
  violence: 'Насилие',
  copyright: 'Авторские права',
  hate: 'Ненависть',
  misinformation: 'Дезинформация',
  other: 'Другое',
}

const statusFilters: { value: ReportStatus | 'all'; label: string }[] = [
  { value: 'open', label: 'Открытые' },
  { value: 'reviewing', label: 'В работе' },
  { value: 'resolved', label: 'Решённые' },
  { value: 'dismissed', label: 'Отклонённые' },
  { value: 'all', label: 'Все' },
]

export function AdminReportsPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<ReportStatus | 'all'>('open')

  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports', filter],
    queryFn: () => fetchReports(filter === 'all' ? undefined : filter),
  })

  const resolve = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'reviewing' | 'resolved' | 'dismissed' }) =>
      resolveReport(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {statusFilters.map((s) => (
          <button
            key={s.value}
            onClick={() => setFilter(s.value)}
            className={
              'px-3 py-1.5 rounded-full text-sm ' +
              (filter === s.value ? 'bg-brand text-white' : 'bg-elevated text-muted hover:text-text')
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Loader />
      ) : !reports || reports.length === 0 ? (
        <EmptyState title="Жалоб нет" />
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <ReportRow key={r.id} report={r} onResolve={(status) => resolve.mutate({ id: r.id, status })} />
          ))}
        </div>
      )}
    </div>
  )
}

function ReportRow({
  report,
  onResolve,
}: {
  report: Report
  onResolve: (status: 'reviewing' | 'resolved' | 'dismissed') => void
}) {
  const target =
    report.targetType === 'video' ? (
      <Link to={`/watch/${report.targetId}`} className="text-brand">
        {report.targetTitle || 'видео'}
      </Link>
    ) : (
      <span className="text-muted">
        {report.targetType}: {report.targetTitle || report.targetId.slice(0, 8)}
      </span>
    )

  const closed = report.status === 'resolved' || report.status === 'dismissed'

  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-danger/15 flex items-center justify-center flex-shrink-0">
          <Flag className="w-4 h-4 text-danger" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{reasonLabels[report.reason]}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-elevated">приоритет {report.priority}</span>
            <StatusBadge status={report.status} />
            <span className="text-muted text-xs ml-auto">{timeAgo(report.createdAt)}</span>
          </div>
          <div className="text-sm mt-1">На: {target}</div>
          {report.details && (
            <p className="text-sm mt-2 text-muted break-words whitespace-pre-wrap">«{report.details}»</p>
          )}
          {report.resolution && (
            <p className="text-xs mt-2 text-muted">Решение: {report.resolution}</p>
          )}

          {!closed && (
            <div className="flex gap-2 mt-3">
              {report.status === 'open' && (
                <Button size="sm" variant="ghost" onClick={() => onResolve('reviewing')}>
                  <Eye className="w-4 h-4 mr-1" /> В работу
                </Button>
              )}
              <Button size="sm" onClick={() => onResolve('resolved')}>
                <Check className="w-4 h-4 mr-1" /> Подтвердить
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onResolve('dismissed')}>
                <X className="w-4 h-4 mr-1" /> Отклонить
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const map: Record<ReportStatus, string> = {
    open: 'bg-danger/15 text-danger',
    reviewing: 'bg-amber-500/15 text-amber-500',
    resolved: 'bg-emerald-500/15 text-emerald-500',
    dismissed: 'bg-elevated text-muted',
  }
  const label: Record<ReportStatus, string> = {
    open: 'открыта',
    reviewing: 'в работе',
    resolved: 'решена',
    dismissed: 'отклонена',
  }
  return <span className={'text-xs px-2 py-0.5 rounded-full ' + map[status]}>{label[status]}</span>
}
