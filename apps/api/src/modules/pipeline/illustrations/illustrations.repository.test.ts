import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { IllustrationsRepository } from './illustrations.repository.js'

describe('IllustrationsRepository', () => {
  let client: ReturnType<typeof createClient>
  let repository: IllustrationsRepository
  const startedAt = new Date('2026-08-11T10:00:00.000Z')
  const run = { projectId: 'project-1', userId: 'user-1', chapterId: 'chapter-1', startedAt }

  beforeEach(async () => {
    client = createClient({ url: 'file::memory:' })
    repository = new IllustrationsRepository(drizzle(client))
    await client.execute(`create table projects (
      id text primary key, user_id text not null, completed_step text, running_step text,
      step_state text not null, step_started_at integer, style text, updated_at integer not null
    )`)
    await client.execute(`create table chapters (
      id text primary key, project_id text not null, name text not null, prompt text not null,
      character_ids_json text, image_path text, generation_status text not null, generation_error text,
      position integer not null, created_at integer not null, updated_at integer not null
    )`)
    await client.execute(`create table characters (
      id text primary key, project_id text not null, name text not null, prompt text not null,
      image_path text, generation_status text not null, generation_error text,
      position integer not null, created_at integer not null, updated_at integer not null
    )`)
    await client.execute({ sql: `insert into projects values ('project-1', 'user-1', 'CHAPTERS', 'ILLUSTRATIONS', 'RUNNING', ?, 'watercolor', ?)`, args: [startedAt.getTime(), startedAt.getTime()] })
    await client.execute(`insert into chapters values ('chapter-1', 'project-1', 'Opening', 'Prompt', '[]', null, 'PENDING', null, 0, 1, 1)`)
  })
  afterEach(() => client.close())

  it('loads durable portrait checkpoint fields for illustration execution', async () => {
    await client.execute(`insert into characters values ('character-1', 'project-1', 'Mole', 'Portrait prompt', '/images/mole.jpg', 'DONE', null, 0, 1, 1)`)

    const project = await repository.findForExecution('project-1', 'user-1')

    expect(project?.characters).toEqual([
      {
        id: 'character-1',
        name: 'Mole',
        prompt: 'Portrait prompt',
        imagePath: '/images/mole.jpg',
        generationStatus: 'DONE',
        generationError: null,
        position: 0,
      },
    ])
  })

  it('accepts the current run through RUNNING and durable DONE checkpoint', async () => {
    await expect(repository.beginIllustration(run)).resolves.toBe(true)
    await expect(repository.completeIllustration({ ...run, imagePath: '/images/chapter.png' })).resolves.toBe(true)
    expect((await client.execute(`select generation_status, image_path, generation_error from chapters`)).rows)
      .toEqual([{ generation_status: 'DONE', image_path: '/images/chapter.png', generation_error: null }])
  })

  it('rejects begin for a stale timestamp or wrong user', async () => {
    await expect(repository.beginIllustration({ ...run, startedAt: new Date('2026-08-11T10:01:00.000Z') })).resolves.toBe(false)
    await expect(repository.beginIllustration({ ...run, userId: 'user-2' })).resolves.toBe(false)
  })

  it('rejects terminal mutations from a stale timestamp', async () => {
    const stale = { ...run, startedAt: new Date('2026-08-11T10:01:00.000Z') }
    await expect(repository.completeIllustration({ ...stale, imagePath: '/images/stale.png' })).resolves.toBe(false)
    await expect(repository.failIllustration({ ...stale, error: 'failed' })).resolves.toBe(false)
  })
})
