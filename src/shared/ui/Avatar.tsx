import { cn } from '@/shared/lib/cn'

interface AvatarProps {
  src?: string
  alt?: string
  size?: number
  className?: string
}

export function Avatar({ src, alt, size = 36, className }: AvatarProps) {
  return (
    <div
      className={cn('rounded-full bg-elevated overflow-hidden flex-shrink-0', className)}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt={alt ?? ''} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full grid place-items-center text-muted text-xs">?</div>
      )}
    </div>
  )
}
