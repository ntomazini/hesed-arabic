import { clsx } from 'clsx'
import { Loader2 } from 'lucide-react'
import { forwardRef } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    'bg-[#1e3a5f] hover:bg-[#1e40af] active:bg-[#1e3a8a]',
    'text-white',
    'border border-transparent',
    'shadow-sm',
  ].join(' '),
  secondary: [
    'bg-white hover:bg-slate-50 active:bg-slate-100',
    'text-slate-700',
    'border border-slate-200 hover:border-slate-300',
    'shadow-sm',
  ].join(' '),
  danger: [
    'bg-red-600 hover:bg-red-700 active:bg-red-800',
    'text-white',
    'border border-transparent',
    'shadow-sm',
  ].join(' '),
  ghost: [
    'bg-transparent hover:bg-slate-100 active:bg-slate-200',
    'text-slate-600 hover:text-slate-900',
    'border border-transparent',
  ].join(' '),
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-lg gap-2',
  lg: 'px-5 py-2.5 text-base rounded-xl gap-2',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    iconPosition = 'left',
    children,
    disabled,
    className,
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={clsx(
        'inline-flex items-center justify-center font-medium',
        'transition-colors duration-150',
        'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#1e3a5f]/40',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
      {!loading && icon && iconPosition === 'left' && (
        <span className="flex-shrink-0">{icon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && icon && iconPosition === 'right' && (
        <span className="flex-shrink-0">{icon}</span>
      )}
    </button>
  )
})

export default Button
