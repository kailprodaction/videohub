import { useQuery } from '@tanstack/react-query'
import { fetchVideos } from '@/api/videos'
import { VideoCard } from '@/features/video/VideoCard'
import { EmptyState, ErrorState, VideoCardSkeleton } from '@/shared/ui/states'

const categoryChips = [
  { label: 'Все', value: '' },
  { label: 'Технологии', value: 'tech' },
  { label: 'Музыка', value: 'music' },
  { label: 'Игры', value: 'gaming' },
  { label: 'Образование', value: 'education' },
  { label: 'Спорт', value: 'sports' },
]

import { useState } from 'react'

export function HomePage() {
  const [category, setCategory] = useState('')
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['videos', 'home'],
    queryFn: () => fetchVideos(),
  })

  const filtered = data?.filter((v) => v.visibility === 'public' && (!category || v.category === category)) ?? []

  return (
    <div className="px-6 py-4">
      <div className="flex gap-2 overflow-x-auto pb-4 sticky top-14 bg-bg z-30">
        {categoryChips.map((chip) => (
          <button
            key={chip.label}
            onClick={() => setCategory(chip.value)}
            className={`px-3 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              category === chip.value
                ? 'bg-text text-bg'
                : 'bg-elevated hover:bg-border text-text'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <VideoCardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && <ErrorState onRetry={() => refetch()} />}

      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState title="Нет видео" message="В этой категории пока ничего нет." />
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
          {filtered.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      )}
    </div>
  )
}
