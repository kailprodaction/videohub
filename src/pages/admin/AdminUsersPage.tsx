import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldOff, ShieldCheck } from 'lucide-react'
import { blockUser, fetchUsers } from '@/api/users'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { Loader } from '@/shared/ui/states'
import { formatDate } from '@/shared/lib/format'

export function AdminUsersPage() {
  const qc = useQueryClient()
  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: fetchUsers })

  const toggle = useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) => blockUser(id, blocked),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  if (isLoading) return <Loader />

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-elevated text-left">
          <tr>
            <th className="px-4 py-3">Пользователь</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Роль</th>
            <th className="px-4 py-3">Создан</th>
            <th className="px-4 py-3">Статус</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {users?.map((u) => (
            <tr key={u.id} className="border-t border-border hover:bg-elevated/50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar src={u.avatarUrl} alt={u.displayName} size={32} />
                  <span className="font-medium">{u.displayName}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-muted">{u.email}</td>
              <td className="px-4 py-3">
                <span className="text-xs uppercase font-semibold">
                  {u.role === 'admin' ? 'Админ' : 'Пользователь'}
                </span>
              </td>
              <td className="px-4 py-3 text-muted">{formatDate(u.createdAt)}</td>
              <td className="px-4 py-3">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    u.blocked
                      ? 'bg-danger/20 text-danger'
                      : 'bg-green-500/20 text-green-700 dark:text-green-300'
                  }`}
                >
                  {u.blocked ? 'Заблокирован' : 'Активен'}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  size="sm"
                  variant={u.blocked ? 'secondary' : 'danger'}
                  onClick={() => toggle.mutate({ id: u.id, blocked: !u.blocked })}
                >
                  {u.blocked ? <ShieldCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                  {u.blocked ? 'Разблокировать' : 'Заблокировать'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
