/**
 * meta.ts — label and badge-variant maps for task status / priority / category.
 *
 * Colors come entirely from design tokens (no hardcoded hex values).
 * Badge variants reference `src/renderer/src/components/ui/badge.tsx` which
 * maps each variant to the token-based palette in globals.css.
 */

import type { TaskStatus, TaskPriority, TaskCategory } from '@shared/types'
import type { BadgeProps } from '@/components/ui/badge'

type BadgeVariant = NonNullable<BadgeProps['variant']>

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo:        'To Do',
  in_progress: 'In Progress',
  done:        'Done',
}

export const STATUS_BADGE_VARIANT: Record<TaskStatus, BadgeVariant> = {
  todo:        'neutral',
  in_progress: 'info',
  done:        'success',
}

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
}

export const PRIORITY_BADGE_VARIANT: Record<TaskPriority, BadgeVariant> = {
  low:    'neutral',
  medium: 'warning',
  high:   'danger',
}

// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------

export const CATEGORY_LABEL: Record<TaskCategory, string> = {
  personal: 'Personal',
  company:  'Company',
}
