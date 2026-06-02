import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchVideos } from '@/api/videos'
import { VideoCard } from '@/features/video/VideoCard'
import { EmptyState, Loader } from '@/shared/ui/states'

export function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''

  const { data, isLoading } = useQuery({
    queryKey: ['videos', { q }],
    queryFn: () => fetchVideos({ q }),
    enabled: q.length > 0,
  })

  return (
    <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">
        Результаты поиска по «{q}»
      </h1>

      {isLoading && <Loader />}
      {!isLoading && (!data || data.length === 0) && (
        <EmptyState title="Ничего не найдено" message="Попробуйте изменить запрос." />
      )}
      {!isLoading && data && data.length > 0 && (
        <div className="space-y-4">
          {data
            .filter((v) => v.visibility === 'public')
            .map((v) => (
              <VideoCard key={v.id} video={v} layout="compact" />
            ))}
        </div>
      )}
    </div>
  )
}
