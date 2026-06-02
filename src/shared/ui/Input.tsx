import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text placeholder:text-muted',
        'focus:border-brand focus:outline-none',
        className,
      )}
      {...props}
    />
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-lg border border-border bg-surface p-3 text-sm text-text placeholder:text-muted',
        'focus:border-brand focus:outline-none resize-y min-h-[80px]',
        className,
      )}
      {...props}
    />
  )
})
