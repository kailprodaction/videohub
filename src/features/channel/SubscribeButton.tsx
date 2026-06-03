import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isSubscribed, subscribe, unsubscribe } from '@/api/subscriptions'
import { Button } from '@/shared/ui/Button'
import { useIsAuthenticated } from '@/stores/authStore'
import { requireAuth } from '@/features/auth/AuthPrompt'

interface SubscribeButtonProps {
  channelId: string
}

export function SubscribeButton({ channelId }: SubscribeButtonProps) {
  const qc = useQueryClient()
  const isAuthed = useIsAuthenticated()
  const { data: subscribed } = useQuery({
    queryKey: ['isSubscribed', channelId],
    queryFn: () => isSubscribed(channelId),
    // Анонимам не запрашиваем — backend всё равно отдаст 401.
    enabled: isAuthed,
  })
  const mutation = useMutation({
    mutationFn: async () => {
      if (subscribed) await unsubscribe(channelId)
      else await subscribe(channelId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['isSubscribed', channelId] })
      qc.invalidateQueries({ queryKey: ['subscriptions'] })
      qc.invalidateQueries({ queryKey: ['channel', channelId] })
    },
  })

  function onClick() {
    if (!requireAuth('Чтобы подписаться на канал, зарегистрируйтесь или войдите.')) return
    mutation.mutate()
  }

  return (
    <Button
      variant={subscribed ? 'secondary' : 'primary'}
      onClick={onClick}
      disabled={mutation.isPending}
    >
      {subscribed ? 'Отписаться' : 'Подписаться'}
    </Button>
  )
}
