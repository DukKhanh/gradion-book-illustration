import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { GeminiBookRepository } from './gemini-book.repository.js'

describe('GeminiBookRepository', () => {
  let client: ReturnType<typeof createClient>
  let repository: GeminiBookRepository

  beforeEach(async () => {
    client = createClient({ url: 'file::memory:' })
    repository = new GeminiBookRepository(drizzle(client))
    await client.execute(`
      create table projects (
        id text primary key not null,
        user_id text not null,
        book_file_path text not null,
        gemini_book_file_uri text,
        gemini_book_state text not null default 'IDLE',
        gemini_book_started_at integer,
        gemini_book_error text,
        updated_at integer not null
      )
    `)
    await client.execute({
      sql: `insert into projects (
        id, user_id, book_file_path, gemini_book_state, updated_at
      ) values ('project-1', 'user-1', '/books/book.txt', 'IDLE', ?)`,
      args: [Date.now()],
    })
  })

  afterEach(() => client.close())

  it('allows exactly one concurrent initialization acquisition', async () => {
    const snapshot = await repository.findByIdForUser('project-1', 'user-1')
    const startedAt = new Date('2026-08-11T10:00:00.000Z')

    const results = await Promise.all([
      repository.acquire({
        projectId: 'project-1',
        userId: 'user-1',
        expected: snapshot!,
        startedAt,
      }),
      repository.acquire({
        projectId: 'project-1',
        userId: 'user-1',
        expected: snapshot!,
        startedAt,
      }),
    ])

    expect(results.filter(Boolean)).toHaveLength(1)
  })

  it('does not acquire another user’s project', async () => {
    const snapshot = await repository.findByIdForUser('project-1', 'user-1')

    await expect(repository.acquire({
      projectId: 'project-1',
      userId: 'user-2',
      expected: snapshot!,
      startedAt: new Date('2026-08-11T10:00:00.000Z'),
    })).resolves.toBe(false)
  })
})
