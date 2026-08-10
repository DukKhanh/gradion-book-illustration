import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ChaptersRepository } from './chapters.repository.js'

describe('ChaptersRepository', () => {
  let client: ReturnType<typeof createClient>
  let repository: ChaptersRepository
  let databaseDirectory: string
  const startedAt = new Date('2026-08-11T10:00:00.000Z')

  beforeEach(async () => {
    databaseDirectory = await mkdtemp(join(tmpdir(), 'gradion-chapters-'))
    client = createClient({ url: `file:${join(databaseDirectory, 'test.db')}` })
    repository = new ChaptersRepository(drizzle(client))
    await client.execute(`create table projects (
      id text primary key, user_id text not null, completed_step text, running_step text,
      step_state text not null, step_started_at integer, style text, gemini_book_file_uri text,
      gemini_book_state text not null, updated_at integer not null
    )`)
    await client.execute(`create table chapters (
      id text primary key, project_id text not null, name text not null, prompt text not null,
      character_ids_json text, image_path text, generation_status text not null,
      generation_error text, position integer not null check(position = 0),
      created_at integer not null, updated_at integer not null,
      unique(project_id, position)
    )`)
    await client.execute({ sql: `insert into projects values ('project-1', 'user-1', 'PORTRAITS', 'CHAPTERS', 'RUNNING', ?, 'watercolor', 'gemini://book', 'READY', ?)`, args: [startedAt.getTime(), startedAt.getTime()] })
  })

  afterEach(() => client.close())

  it('atomically replaces the project chapter at deterministic position zero', async () => {
    await client.execute(`insert into chapters values ('old', 'project-1', 'Old', 'Old prompt', '[]', null, 'PENDING', null, 0, 1, 1)`)
    await expect(repository.replaceForAcquiredRun({
      projectId: 'project-1', userId: 'user-1', startedAt,
      chapter: { id: 'chapter-1', name: 'Opening Scene', prompt: 'Prompt', characterIdsJson: '["character-1"]', position: 0 },
    })).resolves.toBe(true)
    expect((await client.execute(`select id, name, position, generation_status, image_path, generation_error from chapters`)).rows)
      .toEqual([{ id: 'chapter-1', name: 'Opening Scene', position: 0, generation_status: 'PENDING', image_path: null, generation_error: null }])
  })

  it('rejects a stale acquired run without replacing the chapter', async () => {
    await expect(repository.replaceForAcquiredRun({
      projectId: 'project-1', userId: 'user-1', startedAt: new Date('2026-08-11T10:01:00.000Z'),
      chapter: { id: 'chapter-1', name: 'Opening Scene', prompt: 'Prompt', characterIdsJson: '[]', position: 0 },
    })).resolves.toBe(false)
    expect((await client.execute(`select * from chapters`)).rows).toEqual([])
  })

  it('migration preserves valid data and enforces the one-chapter position constraint', async () => {
    const migrationClient = createClient({ url: 'file::memory:' })
    await migrationClient.execute(`create table projects (id text primary key)`)
    await migrationClient.execute(`create table chapters (
      id text primary key, project_id text not null, name text not null, prompt text not null,
      character_ids_json text, image_path text, generation_status text not null,
      generation_error text, position integer not null, created_at integer not null, updated_at integer not null
    )`)
    await migrationClient.execute(`insert into chapters values ('old', 'project-1', 'Opening', 'Prompt', '[]', null, 'PENDING', null, 0, 1, 1)`)
    const migration = await readFile('drizzle/0005_chapter_position_zero.sql', 'utf8')
    await migrationClient.executeMultiple(migration.replaceAll('--> statement-breakpoint', ''))
    expect((await migrationClient.execute(`select id, position from chapters`)).rows).toEqual([{ id: 'old', position: 0 }])

    expect((await migrationClient.execute(`pragma foreign_key_list(chapters)`)).rows)
      .toEqual([expect.objectContaining({ table: 'projects', from: 'project_id', to: 'id', on_delete: 'CASCADE' })])
    const indexes = (await migrationClient.execute(`pragma index_list(chapters)`)).rows
    expect(indexes).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'chapters_project_id_idx', unique: 0 }),
      expect.objectContaining({ name: 'chapters_project_position_unique', unique: 1 }),
    ]))

    await expect(migrationClient.execute(`insert into chapters values ('bad', 'project-1', 'Bad', 'Prompt', '[]', null, 'PENDING', null, 1, 1, 1)`)).rejects.toBeDefined()
    await expect(migrationClient.execute(`insert into chapters values ('second', 'project-1', 'Second', 'Prompt', '[]', null, 'PENDING', null, 0, 1, 1)`)).rejects.toBeDefined()
    await migrationClient.close()
  })
})
