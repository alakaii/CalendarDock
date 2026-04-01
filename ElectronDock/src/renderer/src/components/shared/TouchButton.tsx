import { type ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface TouchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'primary' | 'secondary' | 'destructive'
}

export function TouchButton({ children, className, variant = 'default', ...props }: TouchButtonProps) {
  return (
    <button
      className={clsx(
        // Minimum touch target size
        'min-h-[44px] min-w-[44px] flex items-center justify-center',
        'rounded-lg transition-colors active:scale-95 transition-transform duration-75',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
        {
          'bg-white/10 hover:bg-white/20 text-white': variant === 'default',
          'hover:bg-white/10 text-white': variant === 'ghost',
          'bg-blue-500 hover:bg-blue-600 text-white font-semibold': variant === 'primary',
          'bg-white/10 hover:bg-white/20 text-white border border-white/20': variant === 'secondary',
          'bg-red-500/80 hover:bg-red-600 text-white font-semibold': variant === 'destructive',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
