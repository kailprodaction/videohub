import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brandHover',
  secondary: 'bg-elevated text-text hover:bg-border',
  ghost: 'bg-transparent text-text hover:bg-elevated',
  danger: 'bg-danger text-white hover:opacity-90',
  subtle: 'bg-surface text-text border border-border hover:bg-elevated',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm rounded-md',
  md: 'h-10 px-4 text-sm rounded-lg',
  lg: 'h-11 px-5 text-base rounded-lg',
  icon: 'h-10 w-10 rounded-full grid place-items-center',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
})
