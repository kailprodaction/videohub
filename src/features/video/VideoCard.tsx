import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { Video } from '@/shared/types'
import { getChannelById } from '@/api/channels'
import { Avatar } from '@/shared/ui/Avatar'
import { formatDuration, formatNumber, timeAgo } from '@/shared/lib/format'

interface VideoCardProps {
  video: Video
  layout?: 'grid' | 'compact'
}

export function VideoCard({ video, layout = 'grid' }: VideoCardProps) {
  const { data: channel } = useQuery({
    queryKey: ['channel', video.channelId],
    queryFn: () => getChannelById(video.channelId),
  })

  if (layout === 'compact') {
    return (
      <Link to={`/watch/${video.id}`} className="flex gap-2 group">
        <div className="relative w-40 flex-shrink-0">
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full aspect-video object-cover rounded-lg"
            loading="lazy"
          />
          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded">
            {formatDuration(video.durationSec)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium line-clamp-2 group-hover:text-brand transition-colors">
            {video.title}
          </h4>
          <p className="text-xs text-muted mt-1 truncate">{channel?.name}</p>
          <p className="text-xs text-muted">
            {formatNumber(video.views)} просмотров · {timeAgo(video.uploadedAt)}
          </p>
        </div>
      </Link>
    )
  }

  return (
    <Link to={`/watch/${video.id}`} className="group flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-xl">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
          {formatDuration(video.durationSec)}
        </span>
      </div>
      <div className="flex gap-3">
        <Link
          to={`/channel/${video.channelId}`}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0"
        >
          <Avatar src={channel?.avatarUrl} alt={channel?.name} size={36} />
        </Link>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium leading-tight line-clamp-2 group-hover:text-brand transition-colors">
            {video.title}
          </h3>
          <Link
            to={`/channel/${video.channelId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-muted hover:text-text block mt-1 truncate"
          >
            {channel?.name ?? '—'}
          </Link>
          <p className="text-sm text-muted">
            {formatNumber(video.views)} просмотров · {timeAgo(video.uploadedAt)}
          </p>
        </div>
      </div>
    </Link>
  )
}
