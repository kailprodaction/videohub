import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isSubscribed, subscribe, unsubscribe } from '@/api/subscriptions'
import { Button } from '@/shared/ui/Button'

interface SubscribeButtonProps {
  channelId: string
}

export function SubscribeButton({ channelId }: SubscribeButtonProps) {
  const qc = useQueryClient()
  const { data: subscribed } = useQuery({
    queryKey: ['isSubscribed', channelId],
    queryFn: () => isSubscribed(channelId),
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

  return (
    <Button
      variant={subscribed ? 'secondary' : 'primary'}
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
    >
      {subscribed ? 'Отписаться' : 'Подписаться'}
    </Button>
  )
}
