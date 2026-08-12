import { describe, expect, it, vi } from 'vitest'

import { PIPELINE_STEPS, STEP_STATES } from '../pipeline.constants.js'
import { PipelineService, type PipelineProject, type PipelineRepository } from '../pipeline.service.js'
import type { PipelineStep } from '../pipeline.types.js'
import type { GeminiCharactersAdapter } from './character-generator.port.js'
import { CharactersRepository } from './characters.repository.js'
import { CharactersStepExecutor } from './characters-step.executor.js'

const prompt = Array.from({ length: 50 }, (_, index) => `detail${index}`).join(' ')

class MemoryPipelineRepository implements PipelineRepository {
  completeResult = true
  project: PipelineProject = {
    id: 'project-1', completedStep: PIPELINE_STEPS.STYLE, runningStep: null,
    stepState: STEP_STATES.IDLE, stepStartedAt: null, stepError: null,
  }
  async findByIdForUser(id: string, userId: string) {
    return id === 'project-1' && userId === 'user-1' ? { ...this.project } : null
  }
  async acquireStep(input: { step: PipelineStep, expected: PipelineProject, startedAt: Date }) {
    if (this.project.stepState !== input.expected.stepState || this.project.runningStep !== input.expected.runningStep || this.project.completedStep !== input.expected.completedStep) return false
    this.project = { ...this.project, runningStep: input.step, stepState: STEP_STATES.RUNNING, stepStartedAt: input.startedAt }
    return true
  }
  async completeStep(input: { step: PipelineStep, startedAt: Date }) {
    if (!this.completeResult || !this.matches(input.step, input.startedAt)) return false
    this.project = { ...this.project, completedStep: input.step, runningStep: null, stepState: STEP_STATES.IDLE, stepStartedAt: null, stepError: null }
    return true
  }
  async failStep(input: { step: PipelineStep, startedAt: Date, error: string }) {
    if (!this.matches(input.step, input.startedAt)) return false
    this.project = { ...this.project, stepState: STEP_STATES.FAILED, stepStartedAt: null, stepError: input.error }
    return true
  }
  async recoverStaleStep(input: { staleBefore: Date, error: string }) {
    if (this.project.stepState !== STEP_STATES.RUNNING || !this.project.stepStartedAt || this.project.stepStartedAt >= input.staleBefore) return false
    this.project = { ...this.project, stepState: STEP_STATES.FAILED, stepStartedAt: null, stepError: input.error }
    return true
  }
  private matches(step: PipelineStep, startedAt: Date) {
    return this.project.stepState === STEP_STATES.RUNNING && this.project.runningStep === step && this.project.stepStartedAt?.getTime() === startedAt.getTime()
  }
}

function setup(gemini: GeminiCharactersAdapter) {
  const pipeline = new MemoryPipelineRepository()
  const stored = { style: null as string | null }
  const characters = {
    findForExecution: vi.fn().mockImplementation(async () => ({
      completedStep: PIPELINE_STEPS.STYLE, style: 'watercolor',
      geminiBookState: 'READY', geminiBookFileUri: 'gemini://book-1',
      characters: stored.style ? [{
        name: 'Mole', prompt: stored.style, position: 0,
        generationStatus: 'PENDING', generationError: null, imagePath: null,
      }] : [],
    })),
    replaceForAcquiredRun: vi.fn(async (input: { characters: Array<{ prompt: string }> }) => {
      stored.style = input.characters[0]?.prompt ?? null
      return true
    }),
  } as unknown as CharactersRepository
  let now = new Date('2026-08-11T10:00:00.000Z')
  return {
    pipeline,
    service: new PipelineService(pipeline, new CharactersStepExecutor(characters, gemini), {
      staleAfterMs: 60_000, now: () => now,
    }),
    advance: () => { now = new Date('2026-08-11T10:02:00.000Z') },
  }
}

describe('CHARACTERS through PipelineService', () => {
  it('allows concurrent requests to make exactly one Gemini call', async () => {
    let resolve: (() => void) | undefined
    const gemini: GeminiCharactersAdapter = { generateCharacters: vi.fn(() => new Promise((done) => {
      resolve = () => done({ characters: [{ name: 'Mole', prompt, isAdult: true }] })
    })) }
    const { service } = setup(gemini)
    const first = service.run('user-1', 'project-1', PIPELINE_STEPS.CHARACTERS)
    const second = service.run('user-1', 'project-1', PIPELINE_STEPS.CHARACTERS)
    await expect(second).rejects.toMatchObject({ statusCode: 409 })
    expect(gemini.generateCharacters).toHaveBeenCalledOnce()
    resolve?.()
    await first
  })

  it('completes from a persisted checkpoint after stale recovery without another call', async () => {
    const gemini: GeminiCharactersAdapter = { generateCharacters: vi.fn().mockResolvedValue({
      characters: [{ name: 'Mole', prompt, isAdult: true }],
    }) }
    const { pipeline, service, advance } = setup(gemini)
    pipeline.completeResult = false
    await expect(service.run('user-1', 'project-1', PIPELINE_STEPS.CHARACTERS)).rejects.toMatchObject({ statusCode: 500 })
    expect(pipeline.project.stepState).toBe(STEP_STATES.RUNNING)
    advance()
    await service.recoverStale('user-1', 'project-1')
    pipeline.completeResult = true
    await service.run('user-1', 'project-1', PIPELINE_STEPS.CHARACTERS)
    expect(gemini.generateCharacters).toHaveBeenCalledOnce()
    expect(pipeline.project.completedStep).toBe(PIPELINE_STEPS.CHARACTERS)
  })

  it('marks a provider failure failed without an automatic retry', async () => {
    const gemini: GeminiCharactersAdapter = {
      generateCharacters: vi.fn().mockRejectedValue(new Error('provider down')),
    }
    const { pipeline, service } = setup(gemini)
    await expect(service.run('user-1', 'project-1', PIPELINE_STEPS.CHARACTERS))
      .rejects.toMatchObject({ statusCode: 502 })
    expect(gemini.generateCharacters).toHaveBeenCalledOnce()
    expect(pipeline.project).toMatchObject({
      runningStep: PIPELINE_STEPS.CHARACTERS,
      stepState: STEP_STATES.FAILED,
    })
  })
})
