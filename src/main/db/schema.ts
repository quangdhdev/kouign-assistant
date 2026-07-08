/**
 * schema.ts — Drizzle sqlite-core schema for tasks and notes.
 *
 * Column names match the authoritative DDL in ARCHITECTURE §4 and migrate.ts.
 * The schema is the source of truth for TypeScript row types used by repositories.
 *
 * Note: `pinned` is defined as a raw INTEGER (0/1) to reflect the actual SQLite
 * storage; the repository layer converts it to a boolean when mapping to domain types.
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// tasks
// ---------------------------------------------------------------------------

export const tasks = sqliteTable('tasks', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  title:       text('title').notNull(),
  description: text('description'),
  status:      text('status').notNull().default('todo'),
  priority:    text('priority').notNull().default('medium'),
  category:    text('category').notNull().default('personal'), // legacy — superseded by categoryId; left in place, no longer read/written
  categoryId:  integer('category_id'),                          // FK → categories.id, nullable
  dueDate:     text('due_date'),
  jiraUrl:     text('jira_url'),
  slackUrl:    text('slack_url'),
  createdAt:   text('created_at').notNull(),
  updatedAt:   text('updated_at').notNull(),
  completedAt: text('completed_at'),
})

/** Raw row type as stored in SQLite (snake_case column names, Drizzle's mapping). */
export type TaskRow = InferSelectModel<typeof tasks>
/** Insert-row type (id + timestamps omitted by caller). */
export type NewTaskRow = InferInsertModel<typeof tasks>

// ---------------------------------------------------------------------------
// notes
// ---------------------------------------------------------------------------

export const notes = sqliteTable('notes', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  title:      text('title').notNull(),
  content:    text('content').notNull().default(''),
  type:       text('type').notNull().default('note'),
  url:        text('url'),
  pinned:     integer('pinned').notNull().default(0),  // 0 = false, 1 = true
  categoryId: integer('category_id'),                  // FK → categories.id, nullable
  createdAt:  text('created_at').notNull(),
  updatedAt:  text('updated_at').notNull(),
})

/** Raw row type as stored in SQLite. */
export type NoteRow = InferSelectModel<typeof notes>
/** Insert-row type (id + timestamps omitted by caller). */
export type NewNoteRow = InferInsertModel<typeof notes>

// ---------------------------------------------------------------------------
// categories — user-managed, shared by tasks & notes
// ---------------------------------------------------------------------------

export const categories = sqliteTable('categories', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  name:      text('name').notNull(),
  color:     text('color'),
  createdAt: text('created_at').notNull(),
})

/** Raw row type as stored in SQLite. */
export type CategoryRow = InferSelectModel<typeof categories>
/** Insert-row type (id + timestamp omitted by caller). */
export type NewCategoryRow = InferInsertModel<typeof categories>
