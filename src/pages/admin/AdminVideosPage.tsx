import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Minus, Plus, Save, Trash2 } from 'lucide-react'
import { adminAdjustVideoStats, deleteVideo, fetchVideos } from '@/api/videos'
import { Button } from '@/shared/ui/Button'
import { Loader } from '@/shared/ui/states'
import { formatDuration, formatNumber, timeAgo } from '@/shared/lib/format'
import type { Video } from '@/shared/types'

export function AdminVideosPage() {
  const qc = useQueryClient()
  const [openId, setOpenId] = useState<string | null>(null)
  const { data: videos, isLoading } = useQuery({
    queryKey: ['videos', 'admin'],
    queryFn: () => fetchVideos(),
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteVideo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['videos'] }),
  })

  if (isLoading) return <Loader />

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-elevated text-left">
          <tr>
            <th className="px-4 py-3">Видео</th>
            <th className="px-4 py-3">Загружено</th>
            <th className="px-4 py-3">Просмотры</th>
            <th className="px-4 py-3">Лайки</th>
            <th className="px-4 py-3">Дизлайки</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {videos?.map((v) => (
            <Fragment key={v.id}>
              <tr className="border-t border-border hover:bg-elevated/50">
                <td className="px-4 py-3">
                  <Link to={`/watch/${v.id}`} className="flex items-center gap-3 hover:text-brand">
                    <div className="relative w-24 flex-shrink-0">
                      <img src={v.thumbnailUrl} alt={v.title} className="w-full aspect-video object-cover rounded" />
                      <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded">
                        {formatDuration(v.durationSec)}
                      </span>
                    </div>
                    <span className="line-clamp-2 max-w-xs">{v.title}</span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{timeAgo(v.uploadedAt)}</td>
                <td className="px-4 py-3 font-mono tabular-nums">{formatNumber(v.views)}</td>
                <td className="px-4 py-3 font-mono tabular-nums">{formatNumber(v.likes)}</td>
                <td className="px-4 py-3 font-mono tabular-nums">{formatNumber(v.dislikes)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setOpenId(openId === v.id ? null : v.id)}
                    >
                      {openId === v.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      Накрутка
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => confirm(`Удалить «${v.title}»?`) && remove.mutate(v.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
              {openId === v.id && (
                <tr className="border-t border-border bg-bg">
                  <td colSpan={6} className="px-4 py-4">
                    <VideoStatsForm video={v} onClose={() => setOpenId(null)} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type Field = 'views' | 'likes' | 'dislikes'

function VideoStatsForm({ video, onClose }: { video: Video; onClose: () => void }) {
  const qc = useQueryClient()
  const [deltas, setDeltas] = useState<Record<Field, number>>({ views: 0, likes: 0, dislikes: 0 })

  const labels: Record<Field, string> = {
    views: 'Просмотры',
    likes: 'Лайки',
    dislikes: 'Дизлайки',
  }

  function bump(field: Field, by: number) {
    setDeltas((d) => ({ ...d, [field]: d[field] + by }))
  }
  function set(field: Field, v: number) {
    setDeltas((d) => ({ ...d, [field]: Number.isFinite(v) ? v : 0 }))
  }

  const save = useMutation({
    mutationFn: () =>
      adminAdjustVideoStats(video.id, {
        viewsDelta: deltas.views,
        likesDelta: deltas.likes,
        dislikesDelta: deltas.dislikes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['videos'] })
      qc.invalidateQueries({ queryKey: ['video', video.id] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      setDeltas({ views: 0, likes: 0, dislikes: 0 })
      onClose()
    },
  })

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h4 className="text-sm font-semibold mb-3">
        Накрутка статистики: <span className="text-muted">«{video.title}»</span>
      </h4>
      <div className="space-y-2">
        {(Object.keys(labels) as Field[]).map((f) => (
          <div key={f} className="flex items-center gap-2 flex-wrap">
            <label className="w-28 text-sm">{labels[f]}</label>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="secondary" onClick={() => bump(f, -10)}>
                <Minus className="w-3 h-3" />10
              </Button>
              <Button size="sm" variant="secondary" onClick={() => bump(f, -1)}>
                <Minus className="w-3 h-3" />
              </Button>
              <input
                type="number"
                value={deltas[f]}
                onChange={(e) => set(f, parseInt(e.target.value, 10))}
                className="w-24 h-8 px-2 text-sm rounded border border-border bg-bg text-center"
              />
              <Button size="sm" variant="secondary" onClick={() => bump(f, 1)}>
                <Plus className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="secondary" onClick={() => bump(f, 10)}>
                <Plus className="w-3 h-3" />10
              </Button>
              <Button size="sm" variant="secondary" onClick={() => bump(f, 100)}>
                <Plus className="w-3 h-3" />100
              </Button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted mt-3">
        Изменения применяются сразу к счётчикам видео. Подписки/отписки накручиваются на канал — в разделе «Каналы».
      </p>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="ghost" onClick={onClose}>
          Отмена
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="w-4 h-4" />
          Сохранить
        </Button>
      </div>
    </div>
  )
}
