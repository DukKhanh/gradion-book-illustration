import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { CharactersRepository } from './characters.repository.js'

describe('CharactersRepository', () => {
  let client: ReturnType<typeof createClient>
  let repository: CharactersRepository
  let databaseDirectory: string
  const startedAt = new Date('2026-08-11T10:00:00.000Z')

  beforeEach(async () => {
    databaseDirectory = await mkdtemp(join(tmpdir(), 'gradion-characters-'))
    client = createClient({ url: `file:${join(databaseDirectory, 'test.db')}` })
    await client.execute(`create table projects (
      id text primary key, user_id text not null, completed_step text,
      running_step text, step_state text not null, step_started_at integer,
      step_error text, style text, gemini_book_file_uri text,
      gemini_book_state text not null, updated_at integer not null
    )`)
    await client.execute(`create table characters (
      id text primary key, project_id text not null, name text not null,
      prompt text not null, image_path text, generation_status text not null,
      generation_error text, position integer not null, created_at integer not null,
      updated_at integer not null, check (position in (0, 1))
    )`)
    await client.execute({ sql: `insert into projects values (?, 'user-1', 'STYLE', 'CHARACTERS', 'RUNNING', ?, null, 'watercolor', 'gemini://book', 'READY', ?)`, args: ['project-1', startedAt.getTime(), startedAt.getTime()] })
    repository = new CharactersRepository(drizzle(client))
  })

  afterEach(() => client.close())

  it('migration preserves the table and rejects positions outside zero and one', async () => {
    const migrationClient = createClient({ url: 'file::memory:' })
    await migrationClient.execute(`create table projects (id text primary key)`)
    await migrationClient.execute(`create table characters (
      id text primary key, project_id text not null, name text not null,
      prompt text not null, image_path text, generation_status text not null,
      generation_error text, position integer not null, created_at integer not null,
      updated_at integer not null
    )`)
    const migration = await readFile('drizzle/0004_sturdy_wild_child.sql', 'utf8')
    await migrationClient.executeMultiple(migration.replaceAll('--> statement-breakpoint', ''))
    await expect(migrationClient.execute({ sql: `insert into characters values ('bad', 'project-1', 'Name', 'Prompt', null, 'PENDING', null, 2, 1, 1)`, args: [] })).rejects.toBeDefined()
    await migrationClient.close()
  })

  it('replaces the whole set atomically and rolls it back when an insert fails', async () => {
    await client.execute({ sql: `insert into characters values ('old', 'project-1', 'Old', 'Old prompt', null, 'PENDING', null, 0, 1, 1)`, args: [] })
    await expect(repository.replaceForAcquiredRun({
      projectId: 'project-1', userId: 'user-1', startedAt,
      characters: [
        { id: 'one', name: 'One', prompt: 'Prompt one', position: 0 },
        { id: 'bad', name: 'Bad', prompt: 'Prompt bad', position: 2 },
      ],
    })).rejects.toBeDefined()
    const rows = await client.execute(`select id from characters order by position`)
    expect(rows.rows).toEqual([{ id: 'old' }])
  })

  it('commits a complete two-character replacement at deterministic positions', async () => {
    await client.execute({ sql: `insert into characters values ('old', 'project-1', 'Old', 'Old prompt', null, 'PENDING', null, 0, 1, 1)`, args: [] })

    await expect(repository.replaceForAcquiredRun({
      projectId: 'project-1', userId: 'user-1', startedAt,
      characters: [
        { id: 'character-1', name: 'First', prompt: 'First prompt', position: 0 },
        { id: 'character-2', name: 'Second', prompt: 'Second prompt', position: 1 },
      ],
    })).resolves.toBe(true)

    const rows = await client.execute(`
      select id, name, position, generation_status, image_path, generation_error
      from characters order by position
    `)
    expect(rows.rows).toEqual([
      {
        id: 'character-1', name: 'First', position: 0,
        generation_status: 'PENDING', image_path: null, generation_error: null,
      },
      {
        id: 'character-2', name: 'Second', position: 1,
        generation_status: 'PENDING', image_path: null, generation_error: null,
      },
    ])
  })

  it('does not replace rows when the exact acquired state no longer matches', async () => {
    const result = await repository.replaceForAcquiredRun({
      projectId: 'project-1', userId: 'user-2', startedAt,
      characters: [{ id: 'one', name: 'One', prompt: 'Prompt one', position: 0 }],
    })
    expect(result).toBe(false)
  })
})
