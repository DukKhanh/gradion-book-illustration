import { describe, expect, it, vi } from 'vitest'

import type { GeminiIllustrationAdapter } from '../../../infrastructure/gemini/gemini-illustration-adapter.js'
import { PIPELINE_STEPS } from '../pipeline.constants.js'
import type { PipelineExecutor } from '../pipeline.service.js'
import { IllustrationsRepository } from './illustrations.repository.js'
import { IllustrationsStepExecutor, type IllustrationStorage } from './illustrations-step.executor.js'

const characterPrompt = Array.from({ length: 50 }, (_, index) => `detail${index}`).join(' ')
const startedAt = new Date('2026-08-11T10:00:00.000Z')
const jpeg = Buffer.from([0xff, 0xd8, 0x01, 0x02, 0xff, 0xd9])

function input(overrides: Partial<Parameters<PipelineExecutor['execute']>[0]> = {}) {
  return { userId: 'user-1', projectId: 'project-1', step: PIPELINE_STEPS.ILLUSTRATIONS, startedAt, isRetry: false, retryCompletedStep: PIPELINE_STEPS.CHAPTERS, retryRunningStep: null, ...overrides }
}

function setup(overrides: Partial<{
  chapter: Record<string, unknown>
  character: Record<string, unknown>
  characters: Array<Record<string, unknown>>
  begin: boolean
  complete: boolean
  exists: boolean
  portraitExists: boolean
}> = {}) {
  const defaultCharacter = { id: 'character-1', name: 'Mole', prompt: characterPrompt, position: 0, generationStatus: 'DONE', generationError: null, imagePath: '/portrait.jpg', ...overrides.character }
  const project = {
    completedStep: PIPELINE_STEPS.CHAPTERS,
    style: 'watercolor',
    characters: overrides.characters ?? [defaultCharacter],
    chapters: [{ id: 'chapter-1', name: 'Opening Scene', prompt: 'A warm opening scene.', characterIdsJson: JSON.stringify((overrides.characters ?? [defaultCharacter]).map((character) => character.id)), position: 0, imagePath: null, generationStatus: 'PENDING', generationError: null, ...overrides.chapter }],
  }
  const repository = {
    findForExecution: vi.fn().mockResolvedValue(project),
    beginIllustration: vi.fn().mockResolvedValue(overrides.begin ?? true),
    completeIllustration: vi.fn().mockResolvedValue(overrides.complete ?? true),
    failIllustration: vi.fn().mockResolvedValue(true),
  } as unknown as IllustrationsRepository
  const storage: IllustrationStorage = {
    readPortrait: vi.fn().mockResolvedValue(jpeg),
    portraitExists: vi.fn().mockResolvedValue(overrides.portraitExists ?? true),
    illustrationExists: vi.fn().mockResolvedValue(overrides.exists ?? false),
    writeIllustration: vi.fn().mockResolvedValue('/images/chapter-1/1786442400000.jpg'),
    deleteIllustration: vi.fn(),
  }
  return { project, repository, storage }
}

describe('IllustrationsStepExecutor', () => {
  it('generates one JPEG using the chapter, STYLE, and durable portrait references', async () => {
    const { repository, storage } = setup()
    const gemini: GeminiIllustrationAdapter = { generateIllustration: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]), mimeType: 'image/jpeg' }) }
    await new IllustrationsStepExecutor(repository, gemini, storage).execute(input())
    expect(storage.readPortrait).toHaveBeenCalledWith('/portrait.jpg')
    expect(gemini.generateIllustration).toHaveBeenCalledWith({
      chapterName: 'Opening Scene',
      chapterPrompt: 'A warm opening scene.',
      style: 'watercolor',
      characterReferences: [{ name: 'Mole', prompt: characterPrompt, imageBytes: jpeg, mimeType: 'image/jpeg' }],
    })
    expect(storage.writeIllustration).toHaveBeenCalledBefore(repository.completeIllustration as never)
  })

  it('passes at most the two server-bounded durable portrait references to Gemini', async () => {
    const secondPrompt = Array.from({ length: 50 }, (_, index) => `second${index}`).join(' ')
    const characters = [
      { id: 'character-1', name: 'Mole', prompt: characterPrompt, position: 0, generationStatus: 'DONE', generationError: null, imagePath: '/one.jpg' },
      { id: 'character-2', name: 'Rat', prompt: secondPrompt, position: 1, generationStatus: 'DONE', generationError: null, imagePath: '/two.jpg' },
    ]
    const { repository, storage } = setup({ characters })
    const gemini: GeminiIllustrationAdapter = { generateIllustration: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]), mimeType: 'image/jpeg' }) }
    await new IllustrationsStepExecutor(repository, gemini, storage).execute(input())
    const references = vi.mocked(gemini.generateIllustration).mock.calls[0]?.[0].characterReferences
    expect(references).toHaveLength(2)
    expect(references?.map((reference) => reference.name)).toEqual(['Mole', 'Rat'])
  })

  it('does not call Gemini when a required portrait is missing, unreadable, or not DONE', async () => {
    const missing = setup({ portraitExists: false })
    const missingGemini: GeminiIllustrationAdapter = { generateIllustration: vi.fn() }
    await expect(new IllustrationsStepExecutor(missing.repository, missingGemini, missing.storage).execute(input())).rejects.toMatchObject({ statusCode: 409 })
    expect(missingGemini.generateIllustration).not.toHaveBeenCalled()
    expect(missing.repository.beginIllustration).not.toHaveBeenCalled()

    const unreadable = setup()
    unreadable.storage.readPortrait = vi.fn().mockRejectedValue(new Error('disk'))
    const unreadableGemini: GeminiIllustrationAdapter = { generateIllustration: vi.fn() }
    await expect(new IllustrationsStepExecutor(unreadable.repository, unreadableGemini, unreadable.storage).execute(input())).rejects.toMatchObject({ statusCode: 409 })
    expect(unreadableGemini.generateIllustration).not.toHaveBeenCalled()

    const incomplete = setup({ character: { generationStatus: 'FAILED' } })
    const incompleteGemini: GeminiIllustrationAdapter = { generateIllustration: vi.fn() }
    await expect(new IllustrationsStepExecutor(incomplete.repository, incompleteGemini, incomplete.storage).execute(input())).rejects.toMatchObject({ statusCode: 409 })
    expect(incompleteGemini.generateIllustration).not.toHaveBeenCalled()
  })

  it('rejects a corrupt non-JPEG portrait reference before the paid call', async () => {
    const { repository, storage } = setup()
    storage.readPortrait = vi.fn().mockResolvedValue(Buffer.from([1, 2, 3]))
    const gemini: GeminiIllustrationAdapter = { generateIllustration: vi.fn() }
    await expect(new IllustrationsStepExecutor(repository, gemini, storage).execute(input())).rejects.toMatchObject({ statusCode: 409 })
    expect(gemini.generateIllustration).not.toHaveBeenCalled()
    expect(repository.beginIllustration).not.toHaveBeenCalled()
  })

  it('does not call Gemini after losing the ILLUSTRATIONS acquisition before begin', async () => {
    const { repository, storage } = setup({ begin: false })
    const gemini: GeminiIllustrationAdapter = { generateIllustration: vi.fn() }
    await expect(new IllustrationsStepExecutor(repository, gemini, storage).execute(input())).rejects.toMatchObject({ statusCode: 500, message: 'ILLUSTRATIONS execution is no longer current.' })
    expect(gemini.generateIllustration).not.toHaveBeenCalled()
    expect(storage.writeIllustration).not.toHaveBeenCalled()
    expect(repository.completeIllustration).not.toHaveBeenCalled()
    expect(repository.failIllustration).not.toHaveBeenCalled()
  })

  it('rejects an invalid chapter association before the paid call', async () => {
    for (const characterIdsJson of ['not-json', '["other"]', '["character-1", "character-1"]']) {
      const { repository, storage } = setup({ chapter: { characterIdsJson } })
      const gemini: GeminiIllustrationAdapter = { generateIllustration: vi.fn() }
      await expect(new IllustrationsStepExecutor(repository, gemini, storage).execute(input())).rejects.toBeDefined()
      expect(gemini.generateIllustration).not.toHaveBeenCalled()
    }
  })

  it('regenerates stale RUNNING or DONE metadata with a missing illustration file', async () => {
    for (const chapter of [
      { generationStatus: 'RUNNING', imagePath: null },
      { generationStatus: 'DONE', imagePath: '/missing.png' },
    ]) {
      const { repository, storage } = setup({ chapter, exists: false })
      const gemini: GeminiIllustrationAdapter = { generateIllustration: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]), mimeType: 'image/jpeg' }) }
      await new IllustrationsStepExecutor(repository, gemini, storage).execute(input())
      expect(gemini.generateIllustration).toHaveBeenCalledOnce()
    }
  })

  it('skips only a valid durable illustration checkpoint without rereading portraits', async () => {
    const { repository, storage } = setup({ chapter: { generationStatus: 'DONE', imagePath: '/done.png' }, exists: true })
    const gemini: GeminiIllustrationAdapter = { generateIllustration: vi.fn() }
    await new IllustrationsStepExecutor(repository, gemini, storage).execute(input())
    expect(gemini.generateIllustration).not.toHaveBeenCalled()
    expect(storage.readPortrait).not.toHaveBeenCalled()
    expect(repository.beginIllustration).not.toHaveBeenCalled()
  })

  it('cleans up only the newly written file when the DONE checkpoint fails', async () => {
    const { repository, storage } = setup({ complete: false })
    const gemini: GeminiIllustrationAdapter = { generateIllustration: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]), mimeType: 'image/jpeg' }) }
    await expect(new IllustrationsStepExecutor(repository, gemini, storage).execute(input())).rejects.toMatchObject({
      statusCode: 500, message: 'Illustration checkpoint could not be persisted.',
    })
    expect(storage.deleteIllustration).toHaveBeenCalledWith('/images/chapter-1/1786442400000.jpg')
    expect(repository.failIllustration).not.toHaveBeenCalled()
  })

  it('does not mark DONE after provider or filesystem failure', async () => {
    const provider = setup()
    await expect(new IllustrationsStepExecutor(provider.repository, { generateIllustration: vi.fn().mockRejectedValue(new Error('provider')) }, provider.storage).execute(input())).rejects.toBeDefined()
    expect(provider.repository.completeIllustration).not.toHaveBeenCalled()
    const filesystem = setup()
    filesystem.storage.writeIllustration = vi.fn().mockRejectedValue(new Error('disk'))
    await expect(new IllustrationsStepExecutor(filesystem.repository, { generateIllustration: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]), mimeType: 'image/jpeg' }) }, filesystem.storage).execute(input())).rejects.toBeDefined()
    expect(filesystem.repository.completeIllustration).not.toHaveBeenCalled()
  })

  it('rejects a non-JPEG illustration result without a durable checkpoint', async () => {
    const { repository, storage } = setup()
    await expect(new IllustrationsStepExecutor(repository, { generateIllustration: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]), mimeType: 'image/png' }) }, storage).execute(input())).rejects.toBeDefined()
    expect(storage.writeIllustration).not.toHaveBeenCalled()
    expect(repository.completeIllustration).not.toHaveBeenCalled()
  })
})
