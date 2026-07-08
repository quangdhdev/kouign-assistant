/**
 * CategoryTag.tsx — small "• name" tag showing a task/note's assigned category.
 *
 * Shared by Todos (list rows, kanban cards) and Notes (sidebar rows). Renders
 * nothing when uncategorized (categoryId === null) or the category can't be
 * found (e.g. stale cache right after a delete).
 */

import React from 'react'
import { useCategoriesStore } from '@/store/categories'
import { categoryDotClass } from '@/lib/categoryColors'

interface CategoryTagProps {
  categoryId: number | null
  className?: string
}

export default function CategoryTag({ categoryId, className }: CategoryTagProps): React.ReactElement | null {
  const categories = useCategoriesStore((s) => s.categories)
  if (categoryId === null) return null

  const category = categories.find((c) => c.id === categoryId)
  if (!category) return null

  return (
    <span className={`inline-flex items-center gap-1 text-xs text-muted-foreground ${className ?? ''}`}>
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${categoryDotClass(category.color)}`} />
      {category.name}
    </span>
  )
}
