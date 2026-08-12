import { describe, expect, it, vi } from 'vitest'

import { PIPELINE_STEPS } from '../pipeline.constants.js'
import type { PipelineExecutor } from '../pipeline.service.js'
import type { GeminiPortraitAdapter } from './portrait-generator.port.js'
import { PortraitsRepository } from './portraits.repository.js'
import { PortraitsStepExecutor, type PortraitStorage } from './portraits-step.executor.js'

const prompt = Array.from({ length: 50 }, (_, index) => `detail${index}`).join(' ')
const startedAt = new Date('2026-08-11T10:00:00.000Z')

function runInput(): Parameters<PipelineExecutor['execute']>[0] {
  return { userId: 'user-1', projectId: 'project-1', step: PIPELINE_STEPS.PORTRAITS, startedAt, isRetry: false, retryCompletedStep: PIPELINE_STEPS.CHARACTERS, retryRunningStep: null }
}

function setup(overrides: Partial<{
  characters: Array<Record<string, unknown>>
  complete: boolean
  exists: boolean
}> = {}) {
  const project = {
    completedStep: PIPELINE_STEPS.CHARACTERS, style: 'watercolor',
    characters: overrides.characters ?? [
      { id: 'one', name: 'One', prompt, position: 0, imagePath: null, generationStatus: 'PENDING', generationError: null },
      { id: 'two', name: 'Two', prompt, position: 1, imagePath: null, generationStatus: 'PENDING', generationError: null },
    ],
  }
  const repository = {
    findForExecution: vi.fn().mockResolvedValue(project),
    beginPortrait: vi.fn().mockResolvedValue(true),
    completePortrait: vi.fn().mockResolvedValue(overrides.complete ?? true),
    failPortrait: vi.fn().mockResolvedValue(true),
  } as unknown as PortraitsRepository
  const storage: PortraitStorage = {
    portraitExists: vi.fn().mockResolvedValue(overrides.exists ?? false),
    writePortrait: vi.fn(async (input) => `/images/${input.characterId}/${input.stepStartedAt.getTime()}.jpg`),
    deletePortrait: vi.fn(),
  }
  return { repository, storage }
}

describe('PortraitsStepExecutor', () => {
  it('generates one portrait for a one-character project', async () => {
    const { repository, storage } = setup({ characters: [{
      id: 'one', name: 'One', prompt, position: 0, imagePath: null,
      generationStatus: 'PENDING', generationError: null,
    }] })
    const gemini: GeminiPortraitAdapter = { generatePortrait: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]), mimeType: 'image/jpeg' }) }
    await new PortraitsStepExecutor(repository, gemini, storage).execute(runInput())
    expect(gemini.generatePortrait).toHaveBeenCalledOnce()
  })

  it('does not call Gemini after losing the PORTRAITS acquisition before a character begins', async () => {
    const { repository, storage } = setup({ characters: [{
      id: 'one', name: 'One', prompt, position: 0, imagePath: null,
      generationStatus: 'PENDING', generationError: null,
    }] })
    repository.beginPortrait = vi.fn().mockResolvedValue(false) as never
    const gemini: GeminiPortraitAdapter = { generatePortrait: vi.fn() }

    await expect(new PortraitsStepExecutor(repository, gemini, storage).execute(runInput()))
      .rejects.toMatchObject({
        statusCode: 500,
        message: 'PORTRAITS execution is no longer current.',
      })
    expect(gemini.generatePortrait).not.toHaveBeenCalled()
    expect(storage.writePortrait).not.toHaveBeenCalled()
    expect(repository.completePortrait).not.toHaveBeenCalled()
    expect(repository.failPortrait).not.toHaveBeenCalled()
  })

  it('generates two portraits sequentially in character-position order', async () => {
    const { repository, storage } = setup()
    const gemini: GeminiPortraitAdapter = { generatePortrait: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]), mimeType: 'image/jpeg' }) }
    await new PortraitsStepExecutor(repository, gemini, storage).execute(runInput())
    expect(gemini.generatePortrait).toHaveBeenNthCalledWith(1, expect.objectContaining({ characterName: 'One', style: 'watercolor' }))
    expect(gemini.generatePortrait).toHaveBeenNthCalledWith(2, expect.objectContaining({ characterName: 'Two', style: 'watercolor' }))
    expect(repository.completePortrait).toHaveBeenCalledTimes(2)
  })

  it('preserves the first checkpoint when the second provider call fails', async () => {
    const { repository, storage } = setup()
    const gemini: GeminiPortraitAdapter = { generatePortrait: vi.fn()
      .mockResolvedValueOnce({ bytes: new Uint8Array([1]), mimeType: 'image/jpeg' })
      .mockRejectedValueOnce(new Error('provider')) }
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(new PortraitsStepExecutor(repository, gemini, storage).execute(runInput())).rejects.toBeDefined()
    expect(repository.completePortrait).toHaveBeenCalledTimes(1)
    expect(repository.failPortrait).toHaveBeenCalledWith(expect.objectContaining({ characterId: 'two' }))
    expect(errorLog).toHaveBeenCalledWith('Portrait generation failed.', {
      projectId: 'project-1', characterId: 'two', error: 'provider',
    })
    errorLog.mockRestore()
  })

  it('regenerates a stale character RUNNING status on a newly acquired retry', async () => {
    const { repository, storage } = setup({ characters: [{
      id: 'one', name: 'One', prompt, position: 0, imagePath: null,
      generationStatus: 'RUNNING', generationError: null,
    }] })
    const gemini: GeminiPortraitAdapter = { generatePortrait: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]), mimeType: 'image/jpeg' }) }
    await new PortraitsStepExecutor(repository, gemini, storage).execute(runInput())
    expect(repository.beginPortrait).toHaveBeenCalledOnce()
    expect(gemini.generatePortrait).toHaveBeenCalledOnce()
  })

  it('regenerates DONE metadata when its image file is missing', async () => {
    const { repository, storage } = setup({ characters: [{
      id: 'one', name: 'One', prompt, position: 0, imagePath: '/missing.png',
      generationStatus: 'DONE', generationError: null,
    }], exists: false })
    const gemini: GeminiPortraitAdapter = { generatePortrait: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]), mimeType: 'image/jpeg' }) }
    await new PortraitsStepExecutor(repository, gemini, storage).execute(runInput())
    expect(gemini.generatePortrait).toHaveBeenCalledOnce()
  })

  it('skips a durable DONE portrait with an existing image file', async () => {
    const { repository, storage } = setup({ characters: [{
      id: 'one', name: 'One', prompt, position: 0, imagePath: '/portrait.png',
      generationStatus: 'DONE', generationError: null,
    }], exists: true })
    const gemini: GeminiPortraitAdapter = { generatePortrait: vi.fn() }
    await new PortraitsStepExecutor(repository, gemini, storage).execute(runInput())
    expect(gemini.generatePortrait).not.toHaveBeenCalled()
    expect(repository.beginPortrait).not.toHaveBeenCalled()
  })

  it('deletes a newly written run-scoped file without failing the portrait when its checkpoint transition is lost', async () => {
    const { repository, storage } = setup({ complete: false })
    const gemini: GeminiPortraitAdapter = { generatePortrait: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]), mimeType: 'image/jpeg' }) }
    await expect(new PortraitsStepExecutor(repository, gemini, storage).execute(runInput())).rejects.toMatchObject({
      statusCode: 500,
      message: 'Portrait checkpoint could not be persisted.',
    })
    expect(storage.deletePortrait).toHaveBeenCalledWith('/images/one/1786442400000.jpg')
    expect(repository.failPortrait).not.toHaveBeenCalled()
  })

  it('rejects a non-JPEG portrait result without a durable checkpoint', async () => {
    const { repository, storage } = setup()
    const gemini: GeminiPortraitAdapter = { generatePortrait: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]), mimeType: 'image/png' }) }

    await expect(new PortraitsStepExecutor(repository, gemini, storage).execute(runInput())).rejects.toBeDefined()
    expect(storage.writePortrait).not.toHaveBeenCalled()
    expect(repository.completePortrait).not.toHaveBeenCalled()
  })
})
