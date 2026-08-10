import { describe, expect, it, vi } from 'vitest'

import { PIPELINE_STEPS, STEP_STATES } from '../pipeline.constants.js'
import {
  PipelineService,
  type PipelineProject,
  type PipelineRepository,
} from '../pipeline.service.js'
import type { PipelineStep } from '../pipeline.types.js'
import { StyleStepExecutor } from './style-step.executor.js'
import type { StyleRepository } from './style.repository.js'
import type { GeminiStyleAdapter } from '../../../services/gemini/gemini-style-adapter.js'

class MemoryPipelineRepository implements PipelineRepository {
  completeResult = true
  project: PipelineProject = {
    id: 'project-1', completedStep: null, runningStep: null,
    stepState: STEP_STATES.IDLE, stepStartedAt: null, stepError: null,
  }

  async findByIdForUser(id: string, userId: string) {
    return id === 'project-1' && userId === 'user-1' ? { ...this.project } : null
  }
  async acquireStep(input: { step: PipelineStep, expected: PipelineProject, startedAt: Date }) {
    if (this.project.stepState !== input.expected.stepState ||
      this.project.runningStep !== input.expected.runningStep ||
      this.project.completedStep !== input.expected.completedStep) return false
    this.project = { ...this.project, runningStep: input.step, stepState: STEP_STATES.RUNNING, stepStartedAt: input.startedAt, stepError: null }
    return true
  }
  async completeStep(input: { step: PipelineStep, startedAt: Date }) {
    if (!this.completeResult || !this.isCurrent(input.step, input.startedAt)) return false
    this.project = { ...this.project, completedStep: input.step, runningStep: null, stepState: STEP_STATES.IDLE, stepStartedAt: null, stepError: null }
    return true
  }
  async failStep(input: { step: PipelineStep, startedAt: Date, error: string }) {
    if (!this.isCurrent(input.step, input.startedAt)) return false
    this.project = { ...this.project, stepState: STEP_STATES.FAILED, stepStartedAt: null, stepError: input.error }
    return true
  }
  async recoverStaleStep(input: { staleBefore: Date, error: string }) {
    if (this.project.stepState !== STEP_STATES.RUNNING || !this.project.stepStartedAt || this.project.stepStartedAt >= input.staleBefore) return false
    this.project = { ...this.project, stepState: STEP_STATES.FAILED, stepStartedAt: null, stepError: input.error }
    return true
  }
  private isCurrent(step: PipelineStep, startedAt: Date) {
    return this.project.stepState === STEP_STATES.RUNNING && this.project.runningStep === step && this.project.stepStartedAt?.getTime() === startedAt.getTime()
  }
}

function makeService(
  gemini: GeminiStyleAdapter,
  options: { persistResult?: boolean } = {},
) {
  const pipeline = new MemoryPipelineRepository()
  const project = { style: null as string | null, geminiBookState: 'READY', geminiBookFileUri: 'gemini://book-1' }
  let persistResult = options.persistResult ?? true
  const styles = {
    findForExecution: vi.fn().mockResolvedValue(project),
    persist: vi.fn(async (input: { style: string }) => {
      if (persistResult) project.style = input.style
      return persistResult
    }),
  } as unknown as StyleRepository
  let now = new Date('2026-08-11T10:00:00.000Z')
  const service = new PipelineService(pipeline, new StyleStepExecutor(styles, gemini), {
    staleAfterMs: 60_000,
    now: () => now,
  })
  return {
    pipeline,
    project,
    service,
    setNow: (value: Date) => { now = value },
    setPersistResult: (value: boolean) => { persistResult = value },
  }
}

describe('STYLE through PipelineService', () => {
  it('allows concurrent STYLE requests to make exactly one Gemini call', async () => {
    let resolveGeneration: (() => void) | undefined
    const gemini: GeminiStyleAdapter = {
      generateStyle: vi.fn(() => new Promise((resolve) => {
        resolveGeneration = () => resolve({ style: 'Watercolor storybook illustration with warm hand-painted texture.' })
      })),
    }
    const { service } = makeService(gemini)

    const first = service.run('user-1', 'project-1', PIPELINE_STEPS.STYLE)
    const second = service.run('user-1', 'project-1', PIPELINE_STEPS.STYLE)

    await expect(second).rejects.toMatchObject({ statusCode: 409 })
    expect(gemini.generateStyle).toHaveBeenCalledOnce()
    resolveGeneration?.()
    await first
  })

  it('uses a persisted STYLE checkpoint after stale recovery without another Gemini call', async () => {
    const gemini: GeminiStyleAdapter = {
      generateStyle: vi.fn().mockResolvedValue({
        style: 'Watercolor storybook illustration with warm hand-painted texture.',
      }),
    }
    const { pipeline, project, service, setNow } = makeService(gemini)
    pipeline.completeResult = false

    await expect(service.run('user-1', 'project-1', PIPELINE_STEPS.STYLE)).rejects.toMatchObject({ statusCode: 500 })
    expect(project.style).not.toBeNull()
    expect(pipeline.project.stepState).toBe(STEP_STATES.RUNNING)

    setNow(new Date('2026-08-11T10:02:00.000Z'))
    await service.recoverStale('user-1', 'project-1')
    pipeline.completeResult = true
    await service.run('user-1', 'project-1', PIPELINE_STEPS.STYLE)

    expect(gemini.generateStyle).toHaveBeenCalledOnce()
    expect(pipeline.project).toMatchObject({
      completedStep: PIPELINE_STEPS.STYLE,
      stepState: STEP_STATES.IDLE,
    })
  })

  it('keeps a provider failure retryable without an automatic retry', async () => {
    const gemini: GeminiStyleAdapter = { generateStyle: vi.fn().mockRejectedValue(new Error('provider')) }
    const { pipeline, service } = makeService(gemini)

    await expect(service.run('user-1', 'project-1', PIPELINE_STEPS.STYLE)).rejects.toMatchObject({ statusCode: 502 })
    expect(gemini.generateStyle).toHaveBeenCalledOnce()
    expect(pipeline.project).toMatchObject({ runningStep: PIPELINE_STEPS.STYLE, stepState: STEP_STATES.FAILED })
  })

  it('does not regenerate completed STYLE', async () => {
    const gemini: GeminiStyleAdapter = {
      generateStyle: vi.fn().mockResolvedValue({
        style: 'Watercolor storybook illustration with warm hand-painted texture.',
      }),
    }
    const { service } = makeService(gemini)

    await service.run('user-1', 'project-1', PIPELINE_STEPS.STYLE)
    await expect(service.run('user-1', 'project-1', PIPELINE_STEPS.STYLE)).rejects.toMatchObject({ statusCode: 409 })
    expect(gemini.generateStyle).toHaveBeenCalledOnce()
  })

  it('marks STYLE failed when persistence fails and permits an explicit retry', async () => {
    const gemini: GeminiStyleAdapter = {
      generateStyle: vi.fn().mockResolvedValue({
        style: 'Watercolor storybook illustration with warm hand-painted texture.',
      }),
    }
    const { pipeline, service, setPersistResult } = makeService(gemini, {
      persistResult: false,
    })

    await expect(service.run('user-1', 'project-1', PIPELINE_STEPS.STYLE)).rejects.toMatchObject({ statusCode: 502 })
    expect(pipeline.project).toMatchObject({ runningStep: PIPELINE_STEPS.STYLE, stepState: STEP_STATES.FAILED })

    setPersistResult(true)
    await service.run('user-1', 'project-1', PIPELINE_STEPS.STYLE)
    expect(pipeline.project.completedStep).toBe(PIPELINE_STEPS.STYLE)
    expect(gemini.generateStyle).toHaveBeenCalledTimes(2)
  })
})
