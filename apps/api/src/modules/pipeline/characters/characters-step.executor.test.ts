import { describe, expect, it, vi } from 'vitest'

import { PIPELINE_STEPS } from '../pipeline.constants.js'
import type { PipelineExecutor } from '../pipeline.service.js'
import type { GeminiCharactersAdapter } from '../../../services/gemini/gemini-characters-adapter.js'
import { CharactersRepository } from './characters.repository.js'
import { CharactersStepExecutor } from './characters-step.executor.js'

const validPrompt = Array.from({ length: 50 }, (_, index) => `detail${index + 1}`).join(' ')
const validOutput = {
  characters: [{ name: 'Mole', prompt: validPrompt, isAdult: true }],
}

function input(overrides: Partial<Parameters<PipelineExecutor['execute']>[0]> = {}) {
  return {
    userId: 'user-1', projectId: 'project-1', step: PIPELINE_STEPS.CHARACTERS,
    startedAt: new Date('2026-08-11T10:00:00.000Z'), isRetry: false,
    retryCompletedStep: PIPELINE_STEPS.STYLE, retryRunningStep: null,
    ...overrides,
  }
}

function repository(overrides: Partial<{
  completedStep: string | null
  style: string | null
  geminiBookState: string
  geminiBookFileUri: string | null
  characters: unknown[]
  persist: boolean
}> = {}) {
  const project = {
    completedStep: overrides.completedStep === undefined
      ? PIPELINE_STEPS.STYLE
      : overrides.completedStep,
    style: overrides.style === undefined ? 'watercolor' : overrides.style,
    geminiBookState: overrides.geminiBookState ?? 'READY',
    geminiBookFileUri: overrides.geminiBookFileUri === undefined
      ? 'gemini://book-1'
      : overrides.geminiBookFileUri,
    characters: overrides.characters ?? [],
  }
  return {
    project,
    repository: {
      findForExecution: vi.fn().mockResolvedValue(project),
      replaceForAcquiredRun: vi.fn().mockResolvedValue(overrides.persist ?? true),
    } as unknown as CharactersRepository,
  }
}

describe('CharactersStepExecutor', () => {
  it('uses the persisted book URI and STYLE once, then persists deterministic positions', async () => {
    const store = repository()
    const gemini: GeminiCharactersAdapter = { generateCharacters: vi.fn().mockResolvedValue(validOutput) }
    const executor = new CharactersStepExecutor(store.repository, gemini)

    await executor.execute(input())

    expect(gemini.generateCharacters).toHaveBeenCalledWith({
      bookFileUri: 'gemini://book-1', style: 'watercolor',
    })
    expect(store.repository.replaceForAcquiredRun).toHaveBeenCalledWith(expect.objectContaining({
      characters: [expect.objectContaining({ position: 0, name: 'Mole' })],
    }))
  })

  it('rejects invalid, non-adult, or over-limit output without persistence', async () => {
    const cases = [
      { characters: [{ name: 'Child', prompt: validPrompt, isAdult: false }] },
      { characters: Array.from({ length: 3 }, (_, index) => ({ name: `Adult ${index}`, prompt: validPrompt, isAdult: true })) },
      { characters: [{ name: 'Mole', prompt: 'short', isAdult: true }] },
    ]
    for (const output of cases) {
      const store = repository()
      const gemini: GeminiCharactersAdapter = { generateCharacters: vi.fn().mockResolvedValue(output) }
      await expect(new CharactersStepExecutor(store.repository, gemini).execute(input())).rejects.toBeDefined()
      expect(store.repository.replaceForAcquiredRun).not.toHaveBeenCalled()
    }
  })

  it('makes zero Gemini calls when STYLE or the book reference is invalid', async () => {
    for (const store of [
      repository({ completedStep: null }),
      repository({ style: null }),
      repository({ geminiBookState: 'FAILED' }),
      repository({ geminiBookFileUri: null }),
    ]) {
      const gemini: GeminiCharactersAdapter = { generateCharacters: vi.fn() }
      await expect(new CharactersStepExecutor(store.repository, gemini).execute(input())).rejects.toBeDefined()
      expect(gemini.generateCharacters).not.toHaveBeenCalled()
    }
  })

  it('uses a complete valid checkpoint only for the qualifying retry context', async () => {
    const persisted = [{
      name: 'Mole', prompt: validPrompt, position: 0,
      generationStatus: 'PENDING', generationError: null, imagePath: null,
    }]
    const store = repository({ characters: persisted })
    const gemini: GeminiCharactersAdapter = { generateCharacters: vi.fn() }
    const executor = new CharactersStepExecutor(store.repository, gemini)

    await executor.execute(input({
      isRetry: true,
      retryCompletedStep: PIPELINE_STEPS.STYLE,
      retryRunningStep: PIPELINE_STEPS.CHARACTERS,
    }))
    expect(gemini.generateCharacters).not.toHaveBeenCalled()
    expect(store.repository.replaceForAcquiredRun).not.toHaveBeenCalled()
  })

  it('does not use partial persisted rows as a checkpoint', async () => {
    const store = repository({ characters: [{
      name: 'Mole', prompt: validPrompt, position: 1,
      generationStatus: 'PENDING', generationError: null, imagePath: null,
    }] })
    const gemini: GeminiCharactersAdapter = { generateCharacters: vi.fn().mockResolvedValue(validOutput) }
    await new CharactersStepExecutor(store.repository, gemini).execute(input({
      isRetry: true, retryCompletedStep: PIPELINE_STEPS.STYLE,
      retryRunningStep: PIPELINE_STEPS.CHARACTERS,
    }))
    expect(gemini.generateCharacters).toHaveBeenCalledOnce()
  })
})
