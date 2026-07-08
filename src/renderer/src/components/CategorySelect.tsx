/**
 * CategorySelect.tsx — dropdown to assign a single category (or "None") to a
 * task or note. Shared by TaskDialog and NoteEditor.
 *
 * Radix Select doesn't allow an empty-string item value, so "None" is encoded
 * as a sentinel string and translated back to `null` in onChange.
 */

import React from 'react'
import { useCategoriesStore } from '@/store/categories'
import { categoryDotClass } from '@/lib/categoryColors'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const NONE_VALUE = '__none__'

interface CategorySelectProps {
  value: number | null
  onChange: (categoryId: number | null) => void
  id?: string
  /** Extra classes merged into the trigger — e.g. to blend into a custom (non-themed) surface. */
  triggerClassName?: string
}

export default function CategorySelect({ value, onChange, id, triggerClassName }: CategorySelectProps): React.ReactElement {
  const categories = useCategoriesStore((s) => s.categories)

  function handleChange(v: string): void {
    onChange(v === NONE_VALUE ? null : Number(v))
  }

  return (
    <Select value={value === null ? NONE_VALUE : String(value)} onValueChange={handleChange}>
      <SelectTrigger id={id} className={triggerClassName}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>None</SelectItem>
        {categories.map((c) => (
          <SelectItem key={c.id} value={String(c.id)}>
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full flex-shrink-0 ${categoryDotClass(c.color)}`} />
              {c.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
