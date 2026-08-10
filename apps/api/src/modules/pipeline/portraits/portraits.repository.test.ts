import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PortraitsRepository } from './portraits.repository.js'

describe('PortraitsRepository', () => {
  let client: ReturnType<typeof createClient>
  let repository: PortraitsRepository
  const startedAt = new Date('2026-08-11T10:00:00.000Z')

  beforeEach(async () => {
    client = createClient({ url: 'file::memory:' })
    repository = new PortraitsRepository(drizzle(client))
    await client.execute(`create table projects (
      id text primary key, user_id text not null, running_step text, step_state text not null,
      step_started_at integer, completed_step text, style text, updated_at integer not null
    )`)
    await client.execute(`create table characters (
      id text primary key, project_id text not null, name text not null, prompt text not null,
      image_path text, generation_status text not null, generation_error text,
      position integer not null, created_at integer not null, updated_at integer not null
    )`)
    await client.execute({ sql: `insert into projects values ('project-1', 'user-1', 'PORTRAITS', 'RUNNING', ?, 'CHARACTERS', 'watercolor', ?)`, args: [startedAt.getTime(), startedAt.getTime()] })
    await client.execute(`insert into characters values ('character-1', 'project-1', 'One', 'Prompt', null, 'PENDING', null, 0, 1, 1)`)
  })

  afterEach(() => client.close())

  it('persists DONE only for the exact current acquired project run', async () => {
    await expect(repository.completePortrait({
      projectId: 'project-1', userId: 'user-1', characterId: 'character-1', startedAt,
      imagePath: '/images/one.png',
    })).resolves.toBe(true)
    expect((await client.execute(`select generation_status, image_path from characters`)).rows)
      .toEqual([{ generation_status: 'DONE', image_path: '/images/one.png' }])
  })

  it('rejects a stale execution without updating its character checkpoint', async () => {
    await expect(repository.completePortrait({
      projectId: 'project-1', userId: 'user-1', characterId: 'character-1',
      startedAt: new Date('2026-08-11T10:01:00.000Z'), imagePath: '/images/stale.png',
    })).resolves.toBe(false)
    expect((await client.execute(`select generation_status, image_path from characters`)).rows)
      .toEqual([{ generation_status: 'PENDING', image_path: null }])
  })

  it('rejects beginPortrait for a stale timestamp or wrong user', async () => {
    await expect(repository.beginPortrait({
      projectId: 'project-1', userId: 'user-1', characterId: 'character-1',
      startedAt: new Date('2026-08-11T10:01:00.000Z'),
    })).resolves.toBe(false)
    await expect(repository.beginPortrait({
      projectId: 'project-1', userId: 'user-2', characterId: 'character-1', startedAt,
    })).resolves.toBe(false)
  })

  it('rejects failPortrait for a stale timestamp', async () => {
    await expect(repository.failPortrait({
      projectId: 'project-1', userId: 'user-1', characterId: 'character-1',
      startedAt: new Date('2026-08-11T10:01:00.000Z'), error: 'failed',
    })).resolves.toBe(false)
    expect((await client.execute(`select generation_status from characters`)).rows)
      .toEqual([{ generation_status: 'PENDING' }])
  })
})
