import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { addComment } from '@/api/comments'
import { Textarea } from '@/shared/ui/Input'
import { Button } from '@/shared/ui/Button'
import { Avatar } from '@/shared/ui/Avatar'
import { useQuery } from '@tanstack/react-query'
import { getCurrentUser } from '@/api/users'
import { useIsAuthenticated } from '@/stores/authStore'
import { requireAuth } from '@/features/auth/AuthPrompt'

const schema = z.object({
  text: z.string().trim().min(1, 'Введите текст').max(500, 'Не более 500 символов'),
})
type FormValues = z.infer<typeof schema>

interface CommentFormProps {
  videoId: string
}

export function CommentForm({ videoId }: CommentFormProps) {
  const qc = useQueryClient()
  const [focused, setFocused] = useState(false)
  const isAuthed = useIsAuthenticated()
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    enabled: isAuthed,
  })
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onChange' })

  const mutation = useMutation({
    mutationFn: (text: string) => addComment(videoId, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', videoId] })
      reset()
      setFocused(false)
    },
  })

  function onFocus() {
    if (!requireAuth('Чтобы оставить комментарий, зарегистрируйтесь или войдите.')) return
    setFocused(true)
  }

  return (
    <form
      onSubmit={handleSubmit((data) => {
        if (!requireAuth('Чтобы оставить комментарий, зарегистрируйтесь или войдите.')) return
        mutation.mutate(data.text)
      })}
      className="flex gap-3"
    >
      <Avatar src={user?.avatarUrl} alt={user?.displayName} size={40} />
      <div className="flex-1">
        <Textarea
          rows={focused ? 3 : 1}
          placeholder={isAuthed ? 'Добавить комментарий...' : 'Войдите, чтобы оставить комментарий'}
          onFocus={onFocus}
          {...register('text')}
          className="min-h-[40px]"
        />
        {errors.text && <p className="text-danger text-xs mt-1">{errors.text.message}</p>}
        {focused && (
          <div className="flex justify-end gap-2 mt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                reset()
                setFocused(false)
              }}
            >
              Отмена
            </Button>
            <Button type="submit" size="sm" disabled={!isValid || mutation.isPending}>
              Отправить
            </Button>
          </div>
        )}
      </div>
    </form>
  )
}
