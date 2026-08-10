import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { PIPELINE_STEPS, STEP_STATES } from './pipeline.constants.js'
import { PipelineRepository } from './pipeline.repository.js'

describe('PipelineRepository', () => {
  const projectId = 'project-1'
  const startedAt = new Date('2026-08-11T10:00:00.000Z')
  let client: ReturnType<typeof createClient>
  let repository: PipelineRepository

  beforeEach(async () => {
    client = createClient({ url: 'file::memory:' })
    repository = new PipelineRepository(drizzle(client))

    await client.execute(`
      create table projects (
        id text primary key not null,
        completed_step text,
        running_step text,
        step_state text not null,
        step_started_at integer,
        step_error text,
        updated_at integer not null
      )
    `)
    await client.execute({
      sql: `
        insert into projects (
          id, completed_step, running_step, step_state,
          step_started_at, step_error, updated_at
        ) values (?, null, null, 'IDLE', null, null, ?)
      `,
      args: [projectId, startedAt.getTime()],
    })
  })

  afterEach(() => {
    client.close()
  })

  it('allows exactly one concurrent acquisition from one snapshot', async () => {
    const snapshot = await repository.findById(projectId)
    expect(snapshot).not.toBeNull()

    const results = await Promise.all([
      repository.acquireStep({
        projectId,
        step: PIPELINE_STEPS.STYLE,
        expected: snapshot!,
        startedAt,
      }),
      repository.acquireStep({
        projectId,
        step: PIPELINE_STEPS.STYLE,
        expected: snapshot!,
        startedAt,
      }),
    ])

    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await repository.findById(projectId)).toMatchObject({
      runningStep: PIPELINE_STEPS.STYLE,
      stepState: STEP_STATES.RUNNING,
      stepStartedAt: startedAt,
    })
  })
})
