import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, ThumbsUp } from 'lucide-react'
import { deleteComment, fetchComments } from '@/api/comments'
import { getUserById, getCurrentUser } from '@/api/users'
import { Avatar } from '@/shared/ui/Avatar'
import { Loader, EmptyState } from '@/shared/ui/states'
import { timeAgo, formatNumber } from '@/shared/lib/format'

interface CommentListProps {
  videoId: string
}

export function CommentList({ videoId }: CommentListProps) {
  const qc = useQueryClient()
  const { data: comments, isLoading } = useQuery({
    queryKey: ['comments', videoId],
    queryFn: () => fetchComments(videoId),
  })
  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser })

  const remove = useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', videoId] }),
  })

  if (isLoading) return <Loader />
  if (!comments || comments.length === 0)
    return <EmptyState title="Нет комментариев" message="Будьте первым, кто оставит комментарий." />

  return (
    <ul className="space-y-5">
      {comments.map((c) => (
        <CommentItem
          key={c.id}
          comment={c}
          canDelete={currentUser?.id === c.authorId || currentUser?.role === 'admin'}
          onDelete={() => remove.mutate(c.id)}
        />
      ))}
    </ul>
  )
}

function CommentItem({
  comment,
  canDelete,
  onDelete,
}: {
  comment: { id: string; authorId: string; text: string; likes: number; createdAt: string }
  canDelete: boolean
  onDelete: () => void
}) {
  const { data: author } = useQuery({
    queryKey: ['user', comment.authorId],
    queryFn: () => getUserById(comment.authorId),
  })
  return (
    <li className="flex gap-3">
      <Avatar src={author?.avatarUrl} alt={author?.displayName} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{author?.displayName ?? 'Пользователь'}</span>
          <span className="text-muted text-xs">{timeAgo(comment.createdAt)}</span>
        </div>
        <p className="text-sm mt-1 whitespace-pre-wrap break-words">{comment.text}</p>
        <div className="flex items-center gap-3 mt-2 text-muted text-sm">
          <button className="flex items-center gap-1 hover:text-text">
            <ThumbsUp className="w-4 h-4" />
            <span>{formatNumber(comment.likes)}</span>
          </button>
          {canDelete && (
            <button onClick={onDelete} className="flex items-center gap-1 hover:text-danger">
              <Trash2 className="w-4 h-4" />
              <span>Удалить</span>
            </button>
          )}
        </div>
      </div>
    </li>
  )
}
