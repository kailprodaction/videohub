import { useQuery } from '@tanstack/react-query'
import { getCurrentUser, getUserById } from '@/api/users'
import { getChannelByOwner } from '@/api/channels'
import { getChannelStats } from '@/api/stats'
import { StatsChart } from '@/features/stats/StatsChart'
import { Avatar } from '@/shared/ui/Avatar'
import { Loader, EmptyState } from '@/shared/ui/states'
import { formatNumber } from '@/shared/lib/format'

export function MyStatsPage() {
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser })
  const { data: channel } = useQuery({
    queryKey: ['channel', 'owner', user?.id],
    queryFn: () => (user ? getChannelByOwner(user.id) : null),
    enabled: !!user,
  })
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats', channel?.id],
    queryFn: () => getChannelStats(channel!.id),
    enabled: !!channel,
  })

  if (isLoading || !stats) return <Loader />

  const labels = stats.points.map((p) => p.date.slice(5))
  const totals = stats.points.reduce(
    (acc, p) => ({
      views: acc.views + p.views,
      subscribers: acc.subscribers + p.subscribers,
      likes: acc.likes + p.likes,
      dislikes: acc.dislikes + p.dislikes,
    }),
    { views: 0, subscribers: 0, likes: 0, dislikes: 0 },
  )

  return (
    <div className="px-4 lg:px-8 py-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Статистика канала</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Просмотров за 14 дней" value={formatNumber(totals.views)} accent="text-blue-500" />
        <KpiCard label="Подписчиков за 14 дней" value={`+${formatNumber(totals.subscribers)}`} accent="text-green-500" />
        <KpiCard label="Лайков за 14 дней" value={formatNumber(totals.likes)} accent="text-brand" />
        <KpiCard label="Дизлайков за 14 дней" value={formatNumber(totals.dislikes)} accent="text-yellow-500" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Просмотры по дням">
          <StatsChart
            labels={labels}
            datasets={[{ label: 'Просмотры', data: stats.points.map((p) => p.views) }]}
          />
        </ChartCard>
        <ChartCard title="Прирост подписчиков">
          <StatsChart
            labels={labels}
            datasets={[{ label: 'Новые подписчики', data: stats.points.map((p) => p.subscribers) }]}
            type="bar"
          />
        </ChartCard>
        <ChartCard title="Лайки vs Дизлайки">
          <StatsChart
            labels={labels}
            datasets={[
              { label: 'Лайки', data: stats.points.map((p) => p.likes) },
              { label: 'Дизлайки', data: stats.points.map((p) => p.dislikes) },
            ]}
          />
        </ChartCard>
        <ChartCard title="Активность">
          <ActivityList
            subscribedIds={stats.subscribedRecently}
            unsubscribedIds={stats.unsubscribedRecently}
          />
        </ChartCard>
      </div>
    </div>
  )
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent ?? ''}`}>{value}</p>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      {children}
    </div>
  )
}

function ActivityList({
  subscribedIds,
  unsubscribedIds,
}: {
  subscribedIds: string[]
  unsubscribedIds: string[]
}) {
  if (subscribedIds.length === 0 && unsubscribedIds.length === 0) {
    return <EmptyState title="Активности пока нет" message="Здесь появятся новые подписки и отписки." />
  }
  return (
    <div className="space-y-3">
      {subscribedIds.length > 0 && (
        <div>
          <p className="text-xs text-muted mb-2">Подписались</p>
          <div className="flex flex-col gap-2">
            {subscribedIds.map((id) => (
              <UserLine key={`s-${id}`} userId={id} positive />
            ))}
          </div>
        </div>
      )}
      {unsubscribedIds.length > 0 && (
        <div>
          <p className="text-xs text-muted mb-2">Отписались</p>
          <div className="flex flex-col gap-2">
            {unsubscribedIds.map((id) => (
              <UserLine key={`u-${id}`} userId={id} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function UserLine({ userId, positive }: { userId: string; positive?: boolean }) {
  const { data } = useQuery({ queryKey: ['user', userId], queryFn: () => getUserById(userId) })
  if (!data) return null
  return (
    <div className="flex items-center gap-3">
      <Avatar src={data.avatarUrl} alt={data.displayName} size={28} />
      <span className="text-sm flex-1">{data.displayName}</span>
      <span className={`text-xs ${positive ? 'text-green-500' : 'text-danger'}`}>
        {positive ? '+1' : '-1'}
      </span>
    </div>
  )
}
