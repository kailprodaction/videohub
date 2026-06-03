import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Upload as UploadIcon, Crown, Wallet, Banknote } from 'lucide-react'
import { getCurrentUser, updateProfile } from '@/api/users'
import { getChannelByOwner, updateChannelProfile } from '@/api/channels'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { Input, Textarea } from '@/shared/ui/Input'
import { Loader } from '@/shared/ui/states'
import { formatDate, formatNumber, formatSubscribers } from '@/shared/lib/format'

const schema = z.object({
  displayName: z.string().trim().min(1, 'Введите имя').max(50, 'Не более 50 символов'),
  bio: z.string().trim().max(500, 'Не более 500 символов').optional(),
  avatarUrl: z.string().url('Введите валидный URL').optional().or(z.literal('')),
  channelName: z.string().trim().min(1, 'Введите название канала').max(80),
  channelDescription: z.string().trim().max(1000).optional(),
})

type FormValues = z.infer<typeof schema>

export function MeDashboard() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser })
  const { data: channel } = useQuery({
    queryKey: ['channel', 'owner', user?.id],
    queryFn: () => (user ? getChannelByOwner(user.id) : null),
    enabled: !!user,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  function startEdit() {
    reset({
      displayName: user?.displayName ?? '',
      bio: user?.bio ?? '',
      avatarUrl: user?.avatarUrl ?? '',
      channelName: channel?.name ?? '',
      channelDescription: channel?.description ?? '',
    })
    setEditing(true)
  }

  const save = useMutation({
    mutationFn: async (data: FormValues) => {
      await updateProfile({
        displayName: data.displayName,
        bio: data.bio,
        avatarUrl: data.avatarUrl || undefined,
      })
      if (channel) {
        await updateChannelProfile(channel.id, {
          name: data.channelName,
          description: data.channelDescription || '',
          avatarUrl: data.avatarUrl || channel.avatarUrl,
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['currentUser'] })
      qc.invalidateQueries({ queryKey: ['channel'] })
      setEditing(false)
    },
  })

  if (!user) return <Loader />

  const isAdmin = user.role === 'admin'

  return (
    <div className="px-4 lg:px-8 py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Личный кабинет</h1>
        {!isAdmin && (
        <Link to="/me/upload">
          <Button>
            <UploadIcon className="w-4 h-4" />
            Загрузить видео
          </Button>
        </Link>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <Link
          to="/me/premium"
          className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-3 hover:border-brand transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-brand/15 text-brand grid place-items-center">
            <Crown className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted">Премиум</p>
            <p className="font-semibold">
              {user.premium
                ? user.premiumUntil
                  ? `Активен до ${formatDate(user.premiumUntil)}`
                  : 'Активен'
                : 'Не активен'}
            </p>
          </div>
        </Link>
        <Link
          to="/me/payout"
          className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-3 hover:border-brand transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-elevated text-brand grid place-items-center">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted">Баланс канала</p>
            <p className="font-semibold">{formatNumber(channel?.balance ?? 0)} ₸</p>
          </div>
          <Banknote className="w-4 h-4 text-muted" />
        </Link>
      </div>

      <section className="bg-surface border border-border rounded-2xl p-6">
        {!editing ? (
          <div className="flex items-start gap-6 flex-wrap">
            <Avatar src={user.avatarUrl} alt={user.displayName} size={96} />
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold">{user.displayName}</h2>
              <p className="text-sm text-muted">{user.email}</p>
              {user.bio && <p className="mt-2 text-sm">{user.bio}</p>}
              {channel && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted">Канал</p>
                  <Link to={`/channel/${channel.id}`} className="font-medium hover:text-brand">
                    {channel.name}
                  </Link>
                  <p className="text-xs text-muted mt-1">{formatSubscribers(channel.subscribersCount)}</p>
                </div>
              )}
            </div>
            <Button variant="secondary" onClick={startEdit}>
              <Pencil className="w-4 h-4" />
              Редактировать
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit((data) => save.mutate(data))} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Имя</label>
              <Input {...register('displayName')} />
              {errors.displayName && <p className="text-danger text-xs mt-1">{errors.displayName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">О себе</label>
              <Textarea {...register('bio')} rows={3} />
              {errors.bio && <p className="text-danger text-xs mt-1">{errors.bio.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">URL аватара</label>
              <Input {...register('avatarUrl')} placeholder="https://..." />
              {errors.avatarUrl && <p className="text-danger text-xs mt-1">{errors.avatarUrl.message}</p>}
            </div>
            <div className="border-t border-border pt-4">
              <label className="block text-sm font-medium mb-1">Название канала</label>
              <Input {...register('channelName')} />
              {errors.channelName && <p className="text-danger text-xs mt-1">{errors.channelName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Описание канала</label>
              <Textarea {...register('channelDescription')} rows={3} />
              {errors.channelDescription && (
                <p className="text-danger text-xs mt-1">{errors.channelDescription.message}</p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={isSubmitting || save.isPending}>
                Сохранить
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
