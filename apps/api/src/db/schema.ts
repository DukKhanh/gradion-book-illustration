import {
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),

  name: text('name').notNull(),

  email: text('email')
    .notNull()
    .unique(),

  createdAt: integer('created_at', {
    mode: 'timestamp_ms',
  }).notNull(),
})

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),

  userId: text('user_id')
    .notNull()
    .references(() => users.id),

  title: text('title').notNull(),

  bookFilePath: text('book_file_path')
    .notNull(),

  completedStep: text('completed_step'),

  runningStep: text('running_step'),

  stepState: text('step_state')
    .notNull()
    .default('IDLE'),

  stepStartedAt: integer('step_started_at', {
    mode: 'timestamp_ms',
  }),

  stepError: text('step_error'),

  style: text('style'),

  geminiBookFileUri: text(
    'gemini_book_file_uri',
  ),

  geminiBookInteractionId: text(
    'gemini_book_interaction_id',
  ),

  createdAt: integer('created_at', {
    mode: 'timestamp_ms',
  }).notNull(),

  updatedAt: integer('updated_at', {
    mode: 'timestamp_ms',
  }).notNull(),
})