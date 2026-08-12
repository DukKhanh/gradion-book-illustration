import { describe, expect, it, vi } from 'vitest'

import type { GeminiChapterAdapter } from './chapter-generator.port.js'
import { PIPELINE_STEPS } from '../pipeline.constants.js'
import type { PipelineExecutor } from '../pipeline.service.js'
import { ChaptersRepository } from './chapters.repository.js'
import { ChaptersStepExecutor } from './chapters-step.executor.js'

const validChapter = {
  chapter: {
    name: 'Opening Scene',
    prompt: 'A warm storybook opening scene beside the river, featuring the established main characters in the supplied visual style.',
  },
}

function input(overrides: Partial<Parameters<PipelineExecutor['execute']>[0]> = {}) {
  return {
    userId: 'user-1', projectId: 'project-1', step: PIPELINE_STEPS.CHAPTERS,
    startedAt: new Date('2026-08-11T10:00:00.000Z'), isRetry: false,
    retryCompletedStep: PIPELINE_STEPS.PORTRAITS, retryRunningStep: null,
    ...overrides,
  }
}

function setup(overrides: Partial<{ project: Record<string, unknown>, persisted: boolean }> = {}) {
  const project = {
    completedStep: PIPELINE_STEPS.PORTRAITS,
    style: 'watercolor', geminiBookState: 'READY', geminiBookFileUri: 'gemini://book-1',
    characters: [
      { id: 'character-1', name: 'Mole', prompt: validCharacterPrompt, position: 0, generationStatus: 'DONE', generationError: null, imagePath: '/portrait.png' },
    ],
    chapters: [],
    ...overrides.project,
  }
  const repository = {
    findForExecution: vi.fn().mockResolvedValue(project),
    replaceForAcquiredRun: vi.fn().mockResolvedValue(overrides.persisted ?? true),
  } as unknown as ChaptersRepository
  return { project, repository }
}

const validCharacterPrompt = Array.from({ length: 50 }, (_, index) => `detail${index}`).join(' ')

describe('ChaptersStepExecutor', () => {
  it('uses the book URI, STYLE, and owned characters once then persists position zero', async () => {
    const store = setup()
    const gemini: GeminiChapterAdapter = { generateChapter: vi.fn().mockResolvedValue(validChapter) }

    await new ChaptersStepExecutor(store.repository, gemini).execute(input())

    expect(gemini.generateChapter).toHaveBeenCalledWith({
      bookFileUri: 'gemini://book-1', style: 'watercolor',
      characters: [{ name: 'Mole', prompt: validCharacterPrompt }],
    })
    expect(store.repository.replaceForAcquiredRun).toHaveBeenCalledWith(expect.objectContaining({
      chapter: expect.objectContaining({ name: 'Opening Scene', position: 0 }),
    }))
    const persisted = vi.mocked(store.repository.replaceForAcquiredRun).mock.calls[0]?.[0]
    expect(JSON.parse(persisted!.chapter.characterIdsJson)).toEqual(['character-1'])
  })

  it('rejects malformed or unexpected generated output without persistence', async () => {
    for (const output of [
      [{ name: 'Opening Scene', prompt: 'prompt' }],
      { chapter: { name: 'Opening Scene', prompt: 'prompt', extra: true } },
      { chapters: [validChapter.chapter] },
    ]) {
      const store = setup()
      const gemini: GeminiChapterAdapter = { generateChapter: vi.fn().mockResolvedValue(output) }
      await expect(new ChaptersStepExecutor(store.repository, gemini).execute(input())).rejects.toBeDefined()
      expect(store.repository.replaceForAcquiredRun).not.toHaveBeenCalled()
    }
  })

  it('makes zero Gemini calls when a required prerequisite is invalid', async () => {
    for (const project of [
      { completedStep: PIPELINE_STEPS.CHARACTERS }, { style: null },
      { geminiBookState: 'FAILED' }, { geminiBookFileUri: null },
      { characters: [] },
    ]) {
      const store = setup({ project })
      const gemini: GeminiChapterAdapter = { generateChapter: vi.fn() }
      await expect(new ChaptersStepExecutor(store.repository, gemini).execute(input())).rejects.toBeDefined()
      expect(gemini.generateChapter).not.toHaveBeenCalled()
    }
  })

  it('uses only a qualified explicit retry checkpoint without another Gemini call', async () => {
    const store = setup({ project: {
      chapters: [{
        name: 'Opening Scene', prompt: validChapter.chapter.prompt, position: 0,
        characterIdsJson: JSON.stringify(['character-1']), generationStatus: 'PENDING',
        generationError: null, imagePath: null,
      }],
    } })
    const gemini: GeminiChapterAdapter = { generateChapter: vi.fn() }
    await new ChaptersStepExecutor(store.repository, gemini).execute(input({
      isRetry: true, retryCompletedStep: PIPELINE_STEPS.PORTRAITS,
      retryRunningStep: PIPELINE_STEPS.CHAPTERS,
    }))
    expect(gemini.generateChapter).not.toHaveBeenCalled()
    expect(store.repository.replaceForAcquiredRun).not.toHaveBeenCalled()
  })

  it('does not use malformed or reordered character IDs as a checkpoint', async () => {
    const store = setup({ project: {
      characters: [
        { id: 'character-1', name: 'Mole', prompt: validCharacterPrompt, position: 0, generationStatus: 'DONE', generationError: null, imagePath: '/one.png' },
        { id: 'character-2', name: 'Rat', prompt: validCharacterPrompt, position: 1, generationStatus: 'DONE', generationError: null, imagePath: '/two.png' },
      ],
      chapters: [{
        name: 'Opening Scene', prompt: validChapter.chapter.prompt, position: 0,
        characterIdsJson: JSON.stringify(['character-2', 'character-1']), generationStatus: 'PENDING',
        generationError: null, imagePath: null,
      }],
    } })
    const gemini: GeminiChapterAdapter = { generateChapter: vi.fn().mockResolvedValue(validChapter) }
    await new ChaptersStepExecutor(store.repository, gemini).execute(input({
      isRetry: true, retryCompletedStep: PIPELINE_STEPS.PORTRAITS,
      retryRunningStep: PIPELINE_STEPS.CHAPTERS,
    }))
    expect(gemini.generateChapter).toHaveBeenCalledOnce()
  })

  it('surfaces a persistence failure after a paid result cannot become durable', async () => {
    const store = setup({ persisted: false })
    const gemini: GeminiChapterAdapter = { generateChapter: vi.fn().mockResolvedValue(validChapter) }
    await expect(new ChaptersStepExecutor(store.repository, gemini).execute(input()))
      .rejects.toMatchObject({ statusCode: 500, message: 'CHAPTERS could not be persisted.' })
  })
})
