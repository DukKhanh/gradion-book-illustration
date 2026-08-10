import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  PIPELINE_STEPS,
  STEP_STATES,
} from './pipeline.constants.js'
import {
  PipelineService,
  type PipelineExecutor,
  type PipelineProject,
  type PipelineRepository,
} from './pipeline.service.js'
import type {
  PipelineStep,
  StepState,
} from './pipeline.types.js'

class InMemoryPipelineRepository
  implements PipelineRepository
{
  public completeResult = true
  public failResult = true

  public project: PipelineProject = {
    id: 'project-1',
    completedStep: null,
    runningStep: null,
    stepState: STEP_STATES.IDLE,
    stepStartedAt: null,
    stepError: null,
  }

  async findById(
    projectId: string,
  ): Promise<PipelineProject | null> {
    return this.project.id === projectId
      ? { ...this.project }
      : null
  }

  async acquireStep(input: {
    projectId: string
    step: PipelineStep
    expected: PipelineProject
    startedAt: Date
  }): Promise<boolean> {
    if (!this.matches(input.expected)) {
      return false
    }

    this.project = {
      ...this.project,
      runningStep: input.step,
      stepState: STEP_STATES.RUNNING,
      stepStartedAt: input.startedAt,
      stepError: null,
    }

    return true
  }

  async completeStep(input: {
    projectId: string
    step: PipelineStep
    startedAt: Date
  }): Promise<boolean> {
    if (!this.completeResult) {
      return false
    }

    if (!this.isRunning(input.step, input.startedAt)) {
      return false
    }

    this.project = {
      ...this.project,
      completedStep: input.step,
      runningStep: null,
      stepState: STEP_STATES.IDLE,
      stepStartedAt: null,
      stepError: null,
    }

    return true
  }

  async failStep(input: {
    projectId: string
    step: PipelineStep
    startedAt: Date
    error: string
  }): Promise<boolean> {
    if (!this.failResult) {
      return false
    }

    if (!this.isRunning(input.step, input.startedAt)) {
      return false
    }

    this.project = {
      ...this.project,
      runningStep: input.step,
      stepState: STEP_STATES.FAILED,
      stepStartedAt: null,
      stepError: input.error,
    }

    return true
  }

  async recoverStaleStep(input: {
    projectId: string
    staleBefore: Date
    error: string
  }): Promise<boolean> {
    if (
      this.project.stepState !== STEP_STATES.RUNNING ||
      this.project.stepStartedAt === null ||
      this.project.stepStartedAt > input.staleBefore
    ) {
      return false
    }

    this.project = {
      ...this.project,
      stepState: STEP_STATES.FAILED,
      stepStartedAt: null,
      stepError: input.error,
    }

    return true
  }

  private matches(expected: PipelineProject): boolean {
    return (
      this.project.completedStep === expected.completedStep &&
      this.project.runningStep === expected.runningStep &&
      this.project.stepState === expected.stepState &&
      this.project.stepStartedAt?.getTime() ===
        expected.stepStartedAt?.getTime()
    )
  }

  private isRunning(
    step: PipelineStep,
    startedAt: Date,
  ): boolean {
    return (
      this.project.stepState === STEP_STATES.RUNNING &&
      this.project.runningStep === step &&
      this.project.stepStartedAt?.getTime() ===
        startedAt.getTime()
    )
  }
}

describe('PipelineService', () => {
  let repository: InMemoryPipelineRepository
  let executor: PipelineExecutor
  let service: PipelineService

  beforeEach(() => {
    repository = new InMemoryPipelineRepository()
    executor = {
      execute: vi.fn().mockResolvedValue(undefined),
    }
    service = new PipelineService(repository, executor, {
      staleAfterMs: 60_000,
      now: () => new Date('2026-08-11T10:00:00.000Z'),
    })
  })

  it('runs steps strictly in order', async () => {
    await expect(
      service.run('project-1', PIPELINE_STEPS.CHARACTERS),
    ).rejects.toMatchObject({ statusCode: 409 })

    expect(executor.execute).not.toHaveBeenCalled()

    await service.run('project-1', PIPELINE_STEPS.STYLE)
    await service.run('project-1', PIPELINE_STEPS.CHARACTERS)

    expect(executor.execute).toHaveBeenCalledTimes(2)
    expect(repository.project.completedStep).toBe(
      PIPELINE_STEPS.CHARACTERS,
    )
  })

  it('acquires concurrent requests once before executing', async () => {
    let resolveExecution: (() => void) | undefined
    executor.execute = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveExecution = resolve
        }),
    )

    const first = service.run('project-1', PIPELINE_STEPS.STYLE)
    const second = service.run('project-1', PIPELINE_STEPS.STYLE)

    await expect(second).rejects.toMatchObject({ statusCode: 409 })
    expect(executor.execute).toHaveBeenCalledTimes(1)

    resolveExecution?.()
    await first
  })

  it('preserves the failed step and retries only that step', async () => {
    executor.execute = vi.fn().mockRejectedValue(
      new Error('provider unavailable'),
    )

    await expect(
      service.run('project-1', PIPELINE_STEPS.STYLE),
    ).rejects.toMatchObject({ statusCode: 502 })

    expect(repository.project).toMatchObject({
      completedStep: null,
      runningStep: PIPELINE_STEPS.STYLE,
      stepState: STEP_STATES.FAILED,
      stepStartedAt: null,
      stepError: 'Pipeline execution failed.',
    })

    executor.execute = vi.fn().mockResolvedValue(undefined)
    await service.run('project-1', PIPELINE_STEPS.STYLE)

    expect(repository.project).toMatchObject({
      completedStep: PIPELINE_STEPS.STYLE,
      runningStep: null,
      stepState: STEP_STATES.IDLE,
    })
  })

  it('does not report success when completion cannot be persisted', async () => {
    repository.completeResult = false

    await expect(
      service.run('project-1', PIPELINE_STEPS.STYLE),
    ).rejects.toMatchObject({
      statusCode: 500,
      message: 'Pipeline completion could not be persisted.',
    })

    expect(executor.execute).toHaveBeenCalledTimes(1)
    expect(repository.project.stepState).toBe(STEP_STATES.RUNNING)
  })

  it('reports when a failed transition cannot be persisted', async () => {
    repository.failResult = false
    executor.execute = vi.fn().mockRejectedValue(new Error('provider error'))

    await expect(
      service.run('project-1', PIPELINE_STEPS.STYLE),
    ).rejects.toMatchObject({
      statusCode: 500,
      message: 'Pipeline failure could not be persisted.',
    })

    expect(repository.project.stepState).toBe(STEP_STATES.RUNNING)
  })

  it('recovers a stale running step as failed and permits an explicit retry', async () => {
    repository.project = {
      ...repository.project,
      runningStep: PIPELINE_STEPS.STYLE,
      stepState: STEP_STATES.RUNNING,
      stepStartedAt: new Date('2026-08-11T09:58:00.000Z'),
    }

    await service.recoverStale('project-1')

    expect(repository.project).toMatchObject({
      runningStep: PIPELINE_STEPS.STYLE,
      stepState: STEP_STATES.FAILED,
      stepStartedAt: null,
      stepError: 'Pipeline execution timed out and can be retried.',
    })

    await service.run('project-1', PIPELINE_STEPS.STYLE)
    expect(executor.execute).toHaveBeenCalledTimes(1)
  })

  it('does not recover a non-stale running step', async () => {
    repository.project = {
      ...repository.project,
      runningStep: PIPELINE_STEPS.STYLE,
      stepState: STEP_STATES.RUNNING,
      stepStartedAt: new Date('2026-08-11T09:59:30.000Z'),
    }

    await expect(service.recoverStale('project-1')).rejects.toMatchObject({
      statusCode: 409,
    })
  })
})
