import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Sliders } from 'lucide-react'
import { fetchChannels } from '@/api/channels'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { Loader } from '@/shared/ui/states'
import { formatNumber, formatDate } from '@/shared/lib/format'
import { AdminStatsForm } from '@/features/admin/AdminStatsForm'

export function AdminChannelsPage() {
  const [active, setActive] = useState<string | null>(null)
  const { data: channels, isLoading } = useQuery({ queryKey: ['channels'], queryFn: fetchChannels })

  if (isLoading) return <Loader />

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-elevated text-left">
            <tr>
              <th className="px-4 py-3">Канал</th>
              <th className="px-4 py-3">Хэндл</th>
              <th className="px-4 py-3">Подписчики</th>
              <th className="px-4 py-3">Создан</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {channels?.map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-elevated/50">
                <td className="px-4 py-3">
                  <Link to={`/channel/${c.id}`} className="flex items-center gap-3 hover:text-brand">
                    <Avatar src={c.avatarUrl} alt={c.name} size={32} />
                    <span className="font-medium">{c.name}</span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{c.handle}</td>
                <td className="px-4 py-3">{formatNumber(c.subscribersCount)}</td>
                <td className="px-4 py-3 text-muted">{formatDate(c.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setActive(active === c.id ? null : c.id)}
                  >
                    <Sliders className="w-4 h-4" />
                    Статистика
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {active && <AdminStatsForm channelId={active} onClose={() => setActive(null)} />}
    </div>
  )
}
