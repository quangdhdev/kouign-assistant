/**
 * CategoriesSection.tsx — Settings ▸ Categories manager.
 *
 * Lists the user-managed categories shared by Todos & Notes: color swatch +
 * name, inline rename (click the name), a 6-swatch color picker, an "Add
 * category" row, and delete with inline confirm (referencing tasks/notes
 * become uncategorized — nothing is deleted). Round-trips via the categories
 * store; the caller is responsible for having loaded it (AppShell does this
 * once per unlock session).
 */

import React, { useState } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import type { CategoryColor } from '@shared/types'
import { useCategoriesStore } from '@/store/categories'
import { useTasksStore } from '@/store/tasks'
import { useNotesStore } from '@/store/notes'
import { useToast } from '@/components/ToastProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CATEGORY_COLORS, CATEGORY_COLOR_LABEL, categoryDotClass } from '@/lib/categoryColors'

// ---------------------------------------------------------------------------
// Color swatch picker
// ---------------------------------------------------------------------------

interface ColorSwatchPickerProps {
  value: CategoryColor | null
  onChange: (color: CategoryColor) => void
}

function ColorSwatchPicker({ value, onChange }: ColorSwatchPickerProps): React.ReactElement {
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {CATEGORY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={CATEGORY_COLOR_LABEL[c]}
          aria-label={`Set color ${CATEGORY_COLOR_LABEL[c]}`}
          onClick={() => onChange(c)}
          className={`h-5 w-5 rounded-full flex items-center justify-center transition-shadow ${categoryDotClass(c)} ${
            value === c ? 'ring-2 ring-offset-1 ring-ring' : ''
          }`}
        >
          {value === c && <Check className="h-3 w-3 text-white" />}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------

export default function CategoriesSection(): React.ReactElement {
  const { toast } = useToast()
  const { categories, create, update, remove } = useCategoriesStore()
  const { load: loadTasks } = useTasksStore()
  const { load: loadNotes } = useNotesStore()

  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<CategoryColor>('blue')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  async function handleAdd(): Promise<void> {
    const name = newName.trim()
    if (!name) return
    const created = await create({ name, color: newColor }, toast)
    if (created) {
      setNewName('')
      setNewColor('blue')
    }
  }

  function startRename(id: number, currentName: string): void {
    setEditingId(id)
    setEditingName(currentName)
  }

  async function commitRename(id: number): Promise<void> {
    const name = editingName.trim()
    setEditingId(null)
    if (!name) return
    await update(id, { name }, toast)
  }

  async function handleColorChange(id: number, color: CategoryColor): Promise<void> {
    await update(id, { color }, toast)
  }

  async function handleDelete(id: number): Promise<void> {
    setConfirmDeleteId(null)
    await remove(id, toast)
    // Referencing tasks/notes are now uncategorized server-side — refresh the
    // cached lists so Todos/Notes don't keep showing a deleted category.
    loadTasks().catch(() => {})
    loadNotes().catch(() => {})
  }

  return (
    <section className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Categories
      </p>

      <div className="rounded border border-border bg-card overflow-hidden mb-3">
        {categories.length === 0 ? (
          <p className="text-xs text-muted-foreground px-3 py-2">No categories yet.</p>
        ) : (
          categories.map((cat, i) => (
            <div
              key={cat.id}
              className={`flex items-center gap-2 px-3 py-2 ${i < categories.length - 1 ? 'border-b border-border' : ''}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${categoryDotClass(cat.color)}`} />

              {editingId === cat.id ? (
                <Input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => commitRename(cat.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(cat.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="h-7 text-sm flex-1"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startRename(cat.id, cat.name)}
                  className="text-sm text-foreground flex-1 text-left truncate hover:underline"
                  title="Click to rename"
                >
                  {cat.name}
                </button>
              )}

              <ColorSwatchPicker
                value={cat.color}
                onChange={(color) => handleColorChange(cat.id, color)}
              />

              {confirmDeleteId === cat.id ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">Delete?</span>
                  <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" onClick={() => handleDelete(cat.id)}>
                    Yes
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setConfirmDeleteId(null)}>
                    No
                  </Button>
                </div>
              ) : (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmDeleteId(cat.id)}
                  title="Delete category"
                  aria-label={`Delete ${cat.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add category row */}
      <div className="flex items-center gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          placeholder="New category name…"
          className="h-8 text-sm flex-1"
        />
        <ColorSwatchPicker value={newColor} onChange={setNewColor} />
        <Button size="sm" onClick={handleAdd} className="gap-1 h-8 flex-shrink-0" disabled={!newName.trim()}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">
        Tasks and notes in a deleted category become uncategorized — nothing is deleted.
      </p>
    </section>
  )
}
