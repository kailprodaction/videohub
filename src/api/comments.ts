import { api } from './client'
import type { Comment } from '@/shared/types'

export function fetchComments(videoId: string): Promise<Comment[]> {
  return api<Comment[]>(`/api/videos/${videoId}/comments`)
}

export function addComment(videoId: string, text: string): Promise<Comment> {
  return api<Comment>(`/api/videos/${videoId}/comments`, {
    method: 'POST',
    body: { text },
  })
}

export async function deleteComment(commentId: string): Promise<void> {
  await api(`/api/comments/${commentId}`, { method: 'DELETE' })
}

export function fetchAllComments(): Promise<Comment[]> {
  return api<Comment[]>('/api/admin/comments')
}
