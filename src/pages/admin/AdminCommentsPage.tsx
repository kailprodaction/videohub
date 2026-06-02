import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { deleteComment, fetchAllComments } from '@/api/comments'
import { getUserById } from '@/api/users'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { Loader, EmptyState } from '@/shared/ui/states'
import { timeAgo } from '@/shared/lib/format'

export function AdminCommentsPage() {
  const qc = useQueryClient()
  const { data: comments, isLoading } = useQuery({
    queryKey: ['comments', 'admin'],
    queryFn: () => fetchAllComments(),
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments'] }),
  })

  if (isLoading) return <Loader />
  if (!comments || comments.length === 0)
    return <EmptyState title="Комментариев нет" />

  return (
    <div className="space-y-3">
      {comments.map((c) => (
        <AdminCommentRow
          key={c.id}
          comment={c}
          onDelete={() => confirm('Удалить комментарий?') && remove.mutate(c.id)}
        />
      ))}
    </div>
  )
}

function AdminCommentRow({
  comment,
  onDelete,
}: {
  comment: { id: string; authorId: string; videoId: string; text: string; createdAt: string }
  onDelete: () => void
}) {
  const { data: author } = useQuery({
    queryKey: ['user', comment.authorId],
    queryFn: () => getUserById(comment.authorId),
  })
  return (
    <div className="bg-surface border border-border rounded-2xl p-4 flex gap-3 items-start">
      <Avatar src={author?.avatarUrl} alt={author?.displayName} size={36} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{author?.displayName ?? '—'}</span>
          <span className="text-muted text-xs">{timeAgo(comment.createdAt)}</span>
          <Link to={`/watch/${comment.videoId}`} className="text-brand text-xs ml-auto">
            к видео
          </Link>
        </div>
        <p className="text-sm mt-1 break-words whitespace-pre-wrap">{comment.text}</p>
      </div>
      <Button size="sm" variant="danger" onClick={onDelete}>
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  )
}
