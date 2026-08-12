import { describe, expect, it, vi } from 'vitest'

import type { GeminiIllustrationAdapter } from '../../../infrastructure/gemini/gemini-illustration-adapter.js'
import { PIPELINE_STEPS, STEP_STATES } from '../pipeline.constants.js'
import { PipelineService, type PipelineProject, type PipelineRepository } from '../pipeline.service.js'
import type { PipelineStep } from '../pipeline.types.js'
import { IllustrationsRepository } from './illustrations.repository.js'
import { IllustrationsStepExecutor, type IllustrationStorage } from './illustrations-step.executor.js'

const prompt = Array.from({ length: 50 }, (_, index) => `detail${index}`).join(' ')
const portraitJpeg = Buffer.from([0xff, 0xd8, 0x01, 0xff, 0xd9])

class MemoryPipelineRepository implements PipelineRepository {
  completeResult = true
  project: PipelineProject = { id: 'project-1', completedStep: PIPELINE_STEPS.CHAPTERS, runningStep: null, stepState: STEP_STATES.IDLE, stepStartedAt: null, stepError: null }
  async findByIdForUser(projectId: string, userId: string) { return projectId === 'project-1' && userId === 'user-1' ? { ...this.project } : null }
  async acquireStep(input: { step: PipelineStep, expected: PipelineProject, startedAt: Date }) { if (this.project.stepState !== input.expected.stepState || this.project.runningStep !== input.expected.runningStep || this.project.completedStep !== input.expected.completedStep) return false; this.project = { ...this.project, runningStep: input.step, stepState: STEP_STATES.RUNNING, stepStartedAt: input.startedAt, stepError: null }; return true }
  async completeStep(input: { step: PipelineStep, startedAt: Date }) { if (!this.completeResult || !this.current(input.step, input.startedAt)) return false; this.project = { ...this.project, completedStep: input.step, runningStep: null, stepState: STEP_STATES.IDLE, stepStartedAt: null, stepError: null }; return true }
  async failStep(input: { step: PipelineStep, startedAt: Date, error: string }) { if (!this.current(input.step, input.startedAt)) return false; this.project = { ...this.project, stepState: STEP_STATES.FAILED, stepStartedAt: null, stepError: input.error }; return true }
  async recoverStaleStep(input: { staleBefore: Date, error: string }) { if (this.project.stepState !== STEP_STATES.RUNNING || !this.project.stepStartedAt || this.project.stepStartedAt >= input.staleBefore) return false; this.project = { ...this.project, stepState: STEP_STATES.FAILED, stepStartedAt: null, stepError: input.error }; return true }
  private current(step: PipelineStep, startedAt: Date) { return this.project.stepState === STEP_STATES.RUNNING && this.project.runningStep === step && this.project.stepStartedAt?.getTime() === startedAt.getTime() }
}

function makeService(gemini: GeminiIllustrationAdapter) {
  const pipeline = new MemoryPipelineRepository()
  const project = { completedStep: PIPELINE_STEPS.CHAPTERS, style: 'watercolor', characters: [{ id: 'character-1', name: 'Mole', prompt, position: 0, generationStatus: 'DONE', generationError: null, imagePath: '/portrait.jpg' }], chapters: [{ id: 'chapter-1', name: 'Opening', prompt: 'Opening scene.', characterIdsJson: '["character-1"]', imagePath: null as string | null, generationStatus: 'PENDING', generationError: null as string | null, position: 0 }] }
  const repository = {
    findForExecution: vi.fn().mockResolvedValue(project), beginIllustration: vi.fn().mockResolvedValue(true),
    completeIllustration: vi.fn(async (input: { imagePath: string }) => { project.chapters[0]!.generationStatus = 'DONE'; project.chapters[0]!.imagePath = input.imagePath; return true }), failIllustration: vi.fn().mockResolvedValue(true),
  } as unknown as IllustrationsRepository
  const storage: IllustrationStorage = { readPortrait: vi.fn().mockResolvedValue(portraitJpeg), portraitExists: vi.fn().mockResolvedValue(true), illustrationExists: vi.fn(async (path) => path === '/image.jpg'), writeIllustration: vi.fn().mockResolvedValue('/image.jpg'), deleteIllustration: vi.fn() }
  let now = new Date('2026-08-11T10:00:00.000Z')
  return { pipeline, service: new PipelineService(pipeline, new IllustrationsStepExecutor(repository, gemini, storage), { staleAfterMs: 60_000, now: () => now }), setNow: (value: Date) => { now = value } }
}

describe('ILLUSTRATIONS through PipelineService', () => {
  it('requires CHAPTERS, prevents normal rerun, and permits an explicit failed retry', async () => {
    const beforeChapters: GeminiIllustrationAdapter = { generateIllustration: vi.fn() }
    const blocked = makeService(beforeChapters)
    blocked.pipeline.project.completedStep = PIPELINE_STEPS.PORTRAITS
    await expect(blocked.service.run('user-1', 'project-1', PIPELINE_STEPS.ILLUSTRATIONS)).rejects.toMatchObject({ statusCode: 409 })
    expect(beforeChapters.generateIllustration).not.toHaveBeenCalled()

    const normal: GeminiIllustrationAdapter = { generateIllustration: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]), mimeType: 'image/jpeg' }) }
    const completed = makeService(normal)
    await completed.service.run('user-1', 'project-1', PIPELINE_STEPS.ILLUSTRATIONS)
    await expect(completed.service.run('user-1', 'project-1', PIPELINE_STEPS.ILLUSTRATIONS)).rejects.toMatchObject({ statusCode: 409 })
    expect(normal.generateIllustration).toHaveBeenCalledOnce()

    const retry: GeminiIllustrationAdapter = { generateIllustration: vi.fn().mockRejectedValueOnce(new Error('provider')).mockResolvedValueOnce({ bytes: new Uint8Array([1]), mimeType: 'image/jpeg' }) }
    const failed = makeService(retry)
    await expect(failed.service.run('user-1', 'project-1', PIPELINE_STEPS.ILLUSTRATIONS)).rejects.toMatchObject({ statusCode: 502 })
    await failed.service.run('user-1', 'project-1', PIPELINE_STEPS.ILLUSTRATIONS)
    expect(retry.generateIllustration).toHaveBeenCalledTimes(2)
  })

  it('acquires concurrent ILLUSTRATIONS requests once before the image call', async () => {
    let resolveImage: (() => void) | undefined
    const gemini: GeminiIllustrationAdapter = { generateIllustration: vi.fn(() => new Promise<{ bytes: Uint8Array, mimeType: string }>((resolve) => { resolveImage = () => resolve({ bytes: new Uint8Array([1]), mimeType: 'image/jpeg' }) })) }
    const { service } = makeService(gemini)
    const first = service.run('user-1', 'project-1', PIPELINE_STEPS.ILLUSTRATIONS)
    await expect(service.run('user-1', 'project-1', PIPELINE_STEPS.ILLUSTRATIONS)).rejects.toMatchObject({ statusCode: 409 })
    expect(gemini.generateIllustration).toHaveBeenCalledOnce()
    resolveImage?.()
    await first
  })

  it('acquires concurrent work once and reuses the durable image after lost terminal completion', async () => {
    const gemini: GeminiIllustrationAdapter = { generateIllustration: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]), mimeType: 'image/jpeg' }) }
    const { pipeline, service, setNow } = makeService(gemini)
    pipeline.completeResult = false
    await expect(service.run('user-1', 'project-1', PIPELINE_STEPS.ILLUSTRATIONS)).rejects.toMatchObject({ statusCode: 500 })
    setNow(new Date('2026-08-11T10:02:00.000Z'))
    await service.recoverStale('user-1', 'project-1')
    pipeline.completeResult = true
    await service.run('user-1', 'project-1', PIPELINE_STEPS.ILLUSTRATIONS)
    expect(gemini.generateIllustration).toHaveBeenCalledOnce()
    expect(pipeline.project.completedStep).toBe(PIPELINE_STEPS.ILLUSTRATIONS)
  })
})
