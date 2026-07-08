/**
 * categoryColors.ts — label/class maps for the fixed CategoryColor palette.
 *
 * Colors come entirely from design tokens (`--category-*` in globals.css) via
 * the `bg-category-*` Tailwind utilities — no hardcoded hex values here.
 */

import type { CategoryColor } from '@shared/types'

/** The full fixed set of selectable category colors, in swatch-picker order. */
export const CATEGORY_COLORS: CategoryColor[] = ['gray', 'blue', 'green', 'yellow', 'red', 'purple']

export const CATEGORY_COLOR_LABEL: Record<CategoryColor, string> = {
  gray:   'Gray',
  blue:   'Blue',
  green:  'Green',
  yellow: 'Yellow',
  red:    'Red',
  purple: 'Purple',
}

/** Background utility class for a small color-dot swatch. */
export const CATEGORY_COLOR_DOT_CLASS: Record<CategoryColor, string> = {
  gray:   'bg-category-gray',
  blue:   'bg-category-blue',
  green:  'bg-category-green',
  yellow: 'bg-category-yellow',
  red:    'bg-category-red',
  purple: 'bg-category-purple',
}

/** Dot class for a category's color, falling back to a neutral gray when uncolored. */
export function categoryDotClass(color: CategoryColor | null): string {
  return color ? CATEGORY_COLOR_DOT_CLASS[color] : 'bg-muted-foreground'
}
