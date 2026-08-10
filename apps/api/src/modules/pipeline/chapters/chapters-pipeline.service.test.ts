import { describe, expect, it, vi } from 'vitest'

import type { GeminiChapterAdapter } from '../../../services/gemini/gemini-chapter-adapter.js'
import { PIPELINE_STEPS, STEP_STATES } from '../pipeline.constants.js'
import { PipelineService, type PipelineProject, type PipelineRepository } from '../pipeline.service.js'
import type { PipelineStep } from '../pipeline.types.js'
import { ChaptersRepository } from './chapters.repository.js'
import { ChaptersStepExecutor } from './chapters-step.executor.js'

const characterPrompt = Array.from({ length: 50 }, (_, index) => `detail${index}`).join(' ')
const chapter = { chapter: { name: 'Opening Scene', prompt: 'A storybook opening scene with the established main character.' } }

class MemoryPipelineRepository implements PipelineRepository {
  completeResult = true
  project: PipelineProject = { id: 'project-1', completedStep: PIPELINE_STEPS.PORTRAITS, runningStep: null, stepState: STEP_STATES.IDLE, stepStartedAt: null, stepError: null }
  async findByIdForUser(projectId: string, userId: string) { return projectId === 'project-1' && userId === 'user-1' ? { ...this.project } : null }
  async acquireStep(input: { step: PipelineStep, expected: PipelineProject, startedAt: Date }) {
    if (this.project.stepState !== input.expected.stepState || this.project.runningStep !== input.expected.runningStep || this.project.completedStep !== input.expected.completedStep) return false
    this.project = { ...this.project, runningStep: input.step, stepState: STEP_STATES.RUNNING, stepStartedAt: input.startedAt, stepError: null }
    return true
  }
  async completeStep(input: { step: PipelineStep, startedAt: Date }) {
    if (!this.completeResult || !this.current(input.step, input.startedAt)) return false
    this.project = { ...this.project, completedStep: input.step, runningStep: null, stepState: STEP_STATES.IDLE, stepStartedAt: null, stepError: null }
    return true
  }
  async failStep(input: { step: PipelineStep, startedAt: Date, error: string }) {
    if (!this.current(input.step, input.startedAt)) return false
    this.project = { ...this.project, stepState: STEP_STATES.FAILED, stepStartedAt: null, stepError: input.error }
    return true
  }
  async recoverStaleStep(input: { staleBefore: Date, error: string }) {
    if (this.project.stepState !== STEP_STATES.RUNNING || !this.project.stepStartedAt || this.project.stepStartedAt >= input.staleBefore) return false
    this.project = { ...this.project, stepState: STEP_STATES.FAILED, stepStartedAt: null, stepError: input.error }
    return true
  }
  private current(step: PipelineStep, startedAt: Date) { return this.project.stepState === STEP_STATES.RUNNING && this.project.runningStep === step && this.project.stepStartedAt?.getTime() === startedAt.getTime() }
}

function makeService(gemini: GeminiChapterAdapter) {
  const pipeline = new MemoryPipelineRepository()
  const project = {
    completedStep: PIPELINE_STEPS.PORTRAITS, style: 'watercolor', geminiBookState: 'READY', geminiBookFileUri: 'gemini://book',
    characters: [{ id: 'character-1', name: 'Mole', prompt: characterPrompt, position: 0, generationStatus: 'DONE', generationError: null, imagePath: '/portrait.png' }],
    chapters: [] as Array<Record<string, unknown>>,
  }
  const chapters = {
    findForExecution: vi.fn().mockResolvedValue(project),
    replaceForAcquiredRun: vi.fn(async (input: { chapter: Record<string, unknown> }) => {
      const { id: _id, ...storedChapter } = input.chapter
      project.chapters = [{ ...storedChapter, generationStatus: 'PENDING', generationError: null, imagePath: null }]
      return true
    }),
  } as unknown as ChaptersRepository
  let now = new Date('2026-08-11T10:00:00.000Z')
  return {
    pipeline, project,
    service: new PipelineService(pipeline, new ChaptersStepExecutor(chapters, gemini), { staleAfterMs: 60_000, now: () => now }),
    setNow: (value: Date) => { now = value },
  }
}

describe('CHAPTERS through PipelineService', () => {
  it('acquires concurrent CHAPTERS requests once before the Gemini call', async () => {
    let resolveGeneration: (() => void) | undefined
    const gemini: GeminiChapterAdapter = { generateChapter: vi.fn(() => new Promise((resolve) => { resolveGeneration = () => resolve(chapter) })) }
    const { service } = makeService(gemini)
    const first = service.run('user-1', 'project-1', PIPELINE_STEPS.CHAPTERS)
    await expect(service.run('user-1', 'project-1', PIPELINE_STEPS.CHAPTERS)).rejects.toMatchObject({ statusCode: 409 })
    expect(gemini.generateChapter).toHaveBeenCalledOnce()
    resolveGeneration?.()
    await first
  })

  it('reuses a durable chapter after lost final completion and stale recovery', async () => {
    const gemini: GeminiChapterAdapter = { generateChapter: vi.fn().mockResolvedValue(chapter) }
    const { pipeline, project, service, setNow } = makeService(gemini)
    pipeline.completeResult = false
    await expect(service.run('user-1', 'project-1', PIPELINE_STEPS.CHAPTERS)).rejects.toMatchObject({ statusCode: 500 })
    expect(project.chapters).toHaveLength(1)
    setNow(new Date('2026-08-11T10:02:00.000Z'))
    await service.recoverStale('user-1', 'project-1')
    pipeline.completeResult = true
    await service.run('user-1', 'project-1', PIPELINE_STEPS.CHAPTERS)
    expect(gemini.generateChapter).toHaveBeenCalledOnce()
    expect(pipeline.project.completedStep).toBe(PIPELINE_STEPS.CHAPTERS)
  })
})
