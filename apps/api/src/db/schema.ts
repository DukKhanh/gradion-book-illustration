import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),

    name: text('name').notNull(),

    email: text('email').notNull(),

    createdAt: integer('created_at', {
      mode: 'timestamp_ms',
    }).notNull(),
  },
  (table) => [
    uniqueIndex('users_email_unique').on(table.email),
  ],
)

export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),

    userId: text('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),

    title: text('title').notNull(),

    bookFilePath: text('book_file_path').notNull(),

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

    geminiBookState: text('gemini_book_state')
      .notNull()
      .default('IDLE'),

    geminiBookStartedAt: integer(
      'gemini_book_started_at',
      { mode: 'timestamp_ms' },
    ),

    geminiBookError: text('gemini_book_error'),

    geminiBookInteractionId: text(
      'gemini_book_interaction_id',
    ),

    createdAt: integer('created_at', {
      mode: 'timestamp_ms',
    }).notNull(),

    updatedAt: integer('updated_at', {
      mode: 'timestamp_ms',
    }).notNull(),
  },
  (table) => [
    index('projects_user_id_idx').on(table.userId),
    index('projects_created_at_idx').on(
      table.createdAt,
    ),
  ],
)

export const characters = sqliteTable(
  'characters',
  {
    id: text('id').primaryKey(),

    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, {
        onDelete: 'cascade',
      }),

    name: text('name').notNull(),

    prompt: text('prompt').notNull(),

    imagePath: text('image_path'),

    generationStatus: text(
      'generation_status',
    )
      .notNull()
      .default('PENDING'),

    generationError: text(
      'generation_error',
    ),

    position: integer('position').notNull(),

    createdAt: integer('created_at', {
      mode: 'timestamp_ms',
    }).notNull(),

    updatedAt: integer('updated_at', {
      mode: 'timestamp_ms',
    }).notNull(),
  },
  (table) => [
    index('characters_project_id_idx').on(
      table.projectId,
    ),

    uniqueIndex(
      'characters_project_position_unique',
    ).on(
      table.projectId,
      table.position,
    ),
    check(
      'characters_position_zero_or_one',
      sql`${table.position} in (0, 1)`,
    ),
  ],
)

export const chapters = sqliteTable(
  'chapters',
  {
    id: text('id').primaryKey(),

    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, {
        onDelete: 'cascade',
      }),

    name: text('name').notNull(),

    prompt: text('prompt').notNull(),

    characterIdsJson: text(
      'character_ids_json',
    ),

    imagePath: text('image_path'),

    generationStatus: text(
      'generation_status',
    )
      .notNull()
      .default('PENDING'),

    generationError: text(
      'generation_error',
    ),

    position: integer('position').notNull(),

    createdAt: integer('created_at', {
      mode: 'timestamp_ms',
    }).notNull(),

    updatedAt: integer('updated_at', {
      mode: 'timestamp_ms',
    }).notNull(),
  },
  (table) => [
    index('chapters_project_id_idx').on(
      table.projectId,
    ),

    uniqueIndex(
      'chapters_project_position_unique',
    ).on(
      table.projectId,
      table.position,
    ),
    check(
      'chapters_position_zero',
      sql`${table.position} = 0`,
    ),
  ],
)
