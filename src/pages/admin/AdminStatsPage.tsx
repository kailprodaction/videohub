import { useQuery } from '@tanstack/react-query'
import { Users, Tv, Video, Eye, MessageSquare, Activity } from 'lucide-react'
import { getPlatformStats } from '@/api/stats'
import { StatsChart } from '@/features/stats/StatsChart'
import { Loader } from '@/shared/ui/states'
import { formatNumber } from '@/shared/lib/format'

export function AdminStatsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['platformStats'], queryFn: getPlatformStats })

  if (isLoading || !data) return <Loader />

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard icon={<Users className="w-5 h-5" />} label="Пользователей" value={formatNumber(data.totalUsers)} />
        <StatCard icon={<Tv className="w-5 h-5" />} label="Каналов" value={formatNumber(data.totalChannels)} />
        <StatCard icon={<Video className="w-5 h-5" />} label="Видео" value={formatNumber(data.totalVideos)} />
        <StatCard icon={<Eye className="w-5 h-5" />} label="Просмотров" value={formatNumber(data.totalViews)} />
        <StatCard icon={<MessageSquare className="w-5 h-5" />} label="Комментариев" value={formatNumber(data.totalComments)} />
        <StatCard icon={<Activity className="w-5 h-5" />} label="DAU (сегодня)" value={formatNumber(data.dailyActive.at(-1)?.count ?? 0)} />
      </div>

      <div className="bg-surface border border-border rounded-2xl p-4">
        <h3 className="text-sm font-semibold mb-3">Активность пользователей</h3>
        <StatsChart
          labels={data.dailyActive.map((d) => d.date.slice(5))}
          datasets={[{ label: 'Активных в день', data: data.dailyActive.map((d) => d.count) }]}
        />
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-elevated grid place-items-center text-brand">{icon}</div>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  )
}
