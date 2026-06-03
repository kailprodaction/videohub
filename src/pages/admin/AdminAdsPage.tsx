import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Power, PowerOff, Trash2, Upload as UploadIcon } from 'lucide-react'
import {
  adminCreateAd,
  adminDeleteAd,
  adminListAds,
  adminUpdateAd,
  uploadAdFile,
} from '@/api/ads'
import { Button } from '@/shared/ui/Button'
import { Input, Textarea } from '@/shared/ui/Input'
import { EmptyState, Loader } from '@/shared/ui/states'
import { toast } from '@/shared/ui/toast'
import { formatDate } from '@/shared/lib/format'
import type { Ad } from '@/shared/types'

export function AdminAdsPage() {
  const qc = useQueryClient()
  const { data: ads, isLoading } = useQuery({ queryKey: ['ads', 'admin'], queryFn: adminListAds })
  const [editing, setEditing] = useState<Ad | 'new' | null>(null)

  const remove = useMutation({
    mutationFn: (id: string) => adminDeleteAd(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ads'] })
      toast('Реклама удалена', 'success')
    },
  })

  const toggle = useMutation({
    mutationFn: (ad: Ad) => adminUpdateAd(ad.id, { active: !ad.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ads'] }),
  })

  if (isLoading) return <Loader />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Перед каждым видео случайно выбирается одна активная реклама. Премиум-пользователи рекламу не видят.
        </p>
        <Button onClick={() => setEditing('new')}>
          <Plus className="w-4 h-4" />
          Добавить рекламу
        </Button>
      </div>

      {!ads || ads.length === 0 ? (
        <EmptyState title="Рекламы пока нет" message="Добавьте первый рекламный ролик." />
      ) : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-elevated text-left">
              <tr>
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">Создана</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {ads.map((ad) => (
                <tr key={ad.id} className="border-t border-border hover:bg-elevated/50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{ad.title}</div>
                    {ad.description && (
                      <div className="text-xs text-muted line-clamp-1">{ad.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted max-w-xs truncate">
                    <a href={ad.videoUrl} target="_blank" rel="noreferrer" className="hover:text-brand">
                      {ad.videoUrl}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(ad.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs uppercase font-semibold px-2 py-0.5 rounded ${
                        ad.active
                          ? 'bg-green-500/20 text-green-600 dark:text-green-300'
                          : 'bg-elevated text-muted'
                      }`}
                    >
                      {ad.active ? 'Активна' : 'Выключена'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => toggle.mutate(ad)}>
                        {ad.active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditing(ad)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => confirm(`Удалить «${ad.title}»?`) && remove.mutate(ad.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <AdEditor ad={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function AdEditor({ ad, onClose }: { ad: Ad | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [title, setTitle] = useState(ad?.title ?? '')
  const [description, setDescription] = useState(ad?.description ?? '')
  const [videoUrl, setVideoUrl] = useState(ad?.videoUrl ?? '')
  const [active, setActive] = useState(ad?.active ?? true)
  const [uploading, setUploading] = useState(false)

  const save = useMutation({
    mutationFn: async () => {
      if (ad) {
        await adminUpdateAd(ad.id, {
          title,
          description,
          active,
          ...(videoUrl !== ad.videoUrl ? { videoUrl } : {}),
        })
      } else {
        await adminCreateAd({ title, description, videoUrl, active })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ads'] })
      toast('Реклама сохранена', 'success')
      onClose()
    },
    onError: () => toast('Не удалось сохранить', 'error'),
  })

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setUploading(true)
    try {
      const url = await uploadAdFile(f)
      setVideoUrl(url)
      toast('Файл загружен', 'success')
    } catch {
      toast('Не удалось загрузить файл', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-surface border border-border rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">{ad ? 'Редактировать рекламу' : 'Новая реклама'}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Название</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Описание</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">URL видео</label>
            {videoUrl ? (
              <a href={videoUrl} target="_blank" rel="noreferrer" className="block text-xs text-muted truncate hover:text-brand">
                {videoUrl}
              </a>
            ) : (
              <p className="text-xs text-muted">Загрузите файл mp4 или webm.</p>
            )}
            <label className="mt-2 inline-flex items-center gap-2 text-sm cursor-pointer text-brand hover:underline">
              <UploadIcon className="w-4 h-4" />
              {uploading ? 'Загрузка…' : 'Загрузить файл (mp4/webm)'}
              <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={onFile} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Реклама активна
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={!title || !videoUrl || save.isPending || uploading}
          >
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  )
}
