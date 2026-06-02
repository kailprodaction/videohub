import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getChannelById } from '@/api/channels'
import { fetchVideos } from '@/api/videos'
import { getCurrentUser } from '@/api/users'
import { Avatar } from '@/shared/ui/Avatar'
import { SubscribeButton } from '@/features/channel/SubscribeButton'
import { VideoCard } from '@/features/video/VideoCard'
import { Loader, ErrorState, EmptyState, VideoCardSkeleton } from '@/shared/ui/states'
import { formatSubscribers } from '@/shared/lib/format'

export function ChannelPage() {
  const { channelId = '' } = useParams()
  const { data: channel, isLoading, isError } = useQuery({
    queryKey: ['channel', channelId],
    queryFn: () => getChannelById(channelId),
  })
  const { data: videos, isLoading: vLoading } = useQuery({
    queryKey: ['videos', { channelId }],
    queryFn: () => fetchVideos({ channelId }),
  })
  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser })

  if (isLoading) return <Loader />
  if (isError || !channel) return <ErrorState title="Канал не найден" />

  const isOwn = currentUser?.id === channel.ownerId
  const visibleVideos =
    videos?.filter((v) => isOwn || v.visibility === 'public') ?? []

  return (
    <div>
      <div
        className="h-48 bg-cover bg-center"
        style={{ backgroundImage: `url(${channel.bannerUrl})` }}
      />
      <div className="px-4 lg:px-8 py-6 max-w-[1400px] mx-auto">
        <div className="flex flex-wrap items-center gap-6">
          <Avatar src={channel.avatarUrl} alt={channel.name} size={120} className="border-4 border-bg -mt-12" />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">{channel.name}</h1>
            <p className="text-muted text-sm">
              {channel.handle} · {formatSubscribers(channel.subscribersCount)}
            </p>
            <p className="text-sm mt-2 max-w-2xl">{channel.description}</p>
          </div>
          {!isOwn && <SubscribeButton channelId={channel.id} />}
        </div>

        <div className="mt-8 border-b border-border">
          <h2 className="font-medium pb-3 border-b-2 border-text inline-block">Видео</h2>
        </div>

        <div className="mt-6">
          {vLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <VideoCardSkeleton key={i} />
              ))}
            </div>
          )}
          {!vLoading && visibleVideos.length === 0 && (
            <EmptyState title="У канала пока нет видео" message="Здесь появятся видео этого канала." />
          )}
          {!vLoading && visibleVideos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
              {visibleVideos.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
