import { useState } from 'react'
import { Flag } from 'lucide-react'
import { createReport } from '@/api/reports'
import { requireAuth } from '@/features/auth/AuthPrompt'
import { Button } from '@/shared/ui/Button'
import { Textarea } from '@/shared/ui/Input'
import { ApiError } from '@/api/client'
import type { ReportReason } from '@/shared/types'

const reasons: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Спам или мошенничество' },
  { value: 'nudity', label: 'Порнография / 18+' },
  { value: 'violence', label: 'Насилие или жестокость' },
  { value: 'copyright', label: 'Нарушение авторских прав' },
  { value: 'hate', label: 'Разжигание ненависти' },
  { value: 'misinformation', label: 'Дезинформация' },
  { value: 'other', label: 'Другое' },
]

interface Props {
  targetType: 'video' | 'comment' | 'channel'
  targetId: string
}

export function ReportButton({ targetType, targetId }: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>('spam')
  const [details, setDetails] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  function onOpen() {
    if (!requireAuth('Чтобы пожаловаться на контент, войдите в аккаунт.')) return
    setOpen(true)
    setStatus('idle')
    setError('')
  }

  async function submit() {
    setStatus('sending')
    try {
      await createReport({ targetType, targetId, reason, details: details.trim() })
      setStatus('done')
      setTimeout(() => setOpen(false), 1400)
    } catch (e) {
      setStatus('error')
      setError(
        e instanceof ApiError && e.code === 'duplicate'
          ? 'Вы уже жаловались на этот контент — жалоба на рассмотрении.'
          : 'Не удалось отправить жалобу. Попробуйте позже.',
      )
    }
  }

  return (
    <>
      <button
        onClick={onOpen}
        className="flex items-center gap-2 px-4 h-10 rounded-full bg-elevated hover:bg-border text-sm"
        title="Пожаловаться"
      >
        <Flag className="w-4 h-4" />
        <span className="hidden sm:inline">Пожаловаться</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-surface border border-border rounded-2xl p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-1">Пожаловаться на контент</h3>
            <p className="text-sm text-muted mb-4">
              Жалоба попадёт модераторам. Ложные жалобы могут привести к ограничениям.
            </p>

            {status === 'done' ? (
              <p className="text-sm text-brand py-4">Спасибо! Жалоба отправлена на рассмотрение.</p>
            ) : (
              <>
                <label className="block text-sm font-medium mb-1">Причина</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ReportReason)}
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm mb-4"
                >
                  {reasons.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>

                <label className="block text-sm font-medium mb-1">Комментарий (необязательно)</label>
                <Textarea
                  rows={3}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Опишите проблему подробнее..."
                  maxLength={1000}
                />

                {status === 'error' && <p className="text-danger text-sm mt-2">{error}</p>}

                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="ghost" onClick={() => setOpen(false)}>
                    Отмена
                  </Button>
                  <Button variant="danger" onClick={submit} disabled={status === 'sending'}>
                    {status === 'sending' ? 'Отправка...' : 'Отправить жалобу'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
