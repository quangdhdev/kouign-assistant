import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-[var(--radius)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap',
  {
    variants: {
      variant: {
        default:   'bg-secondary text-secondary-foreground',
        primary:   'bg-primary text-primary-foreground',
        success:   'bg-badge-success-bg text-badge-success-text',
        warning:   'bg-badge-warning-bg text-badge-warning-text',
        danger:    'bg-badge-danger-bg text-badge-danger-text',
        info:      'bg-badge-info-bg text-badge-info-text',
        neutral:   'bg-badge-neutral-bg text-badge-neutral-text',
        outline:   'border border-border text-foreground bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps): React.ReactElement {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
