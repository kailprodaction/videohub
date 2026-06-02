import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchSubscriptions } from '@/api/subscriptions'
import { getChannelById } from '@/api/channels'
import { fetchVideos } from '@/api/videos'
import { Avatar } from '@/shared/ui/Avatar'
import { VideoCard } from '@/features/video/VideoCard'
import { EmptyState, Loader } from '@/shared/ui/states'
import { formatSubscribers } from '@/shared/lib/format'
import { SubscribeButton } from '@/features/channel/SubscribeButton'

export function SubscriptionsPage() {
  const { data: subs, isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => fetchSubscriptions(),
  })

  if (isLoading) return <Loader />
  if (!subs || subs.length === 0)
    return (
      <div className="py-10">
        <EmptyState
          title="Нет подписок"
          message="Найдите интересные каналы и подпишитесь на них."
        />
      </div>
    )

  return (
    <div className="px-4 lg:px-8 py-6 max-w-6xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Подписки</h1>
      {subs.map((s) => (
        <ChannelSection key={s.id} channelId={s.channelId} />
      ))}
    </div>
  )
}

function ChannelSection({ channelId }: { channelId: string }) {
  const { data: channel } = useQuery({
    queryKey: ['channel', channelId],
    queryFn: () => getChannelById(channelId),
  })
  const { data: videos } = useQuery({
    queryKey: ['videos', { channelId }],
    queryFn: () => fetchVideos({ channelId, limit: 4 }),
  })

  if (!channel) return null

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <Link to={`/channel/${channel.id}`}>
          <Avatar src={channel.avatarUrl} alt={channel.name} size={48} />
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={`/channel/${channel.id}`} className="font-medium hover:text-brand">
            {channel.name}
          </Link>
          <p className="text-xs text-muted">{formatSubscribers(channel.subscribersCount)}</p>
        </div>
        <SubscribeButton channelId={channel.id} />
      </div>
      {videos && videos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-6">
          {videos.filter((v) => v.visibility === 'public').map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      )}
    </section>
  )
}
