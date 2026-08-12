import { describe, expect, it, vi } from 'vitest'

import { PIPELINE_STEPS } from '../pipeline.constants.js'
import { StyleStepExecutor } from './style-step.executor.js'
import type { StyleRepository } from './style.repository.js'
import type { GeminiStyleAdapter } from './style-generator.port.js'

const startedAt = new Date('2026-08-11T10:00:00.000Z')

function makeRepository(overrides: Partial<{
  style: string | null
  geminiBookState: string
  geminiBookFileUri: string | null
  persist: boolean
}> = {}) {
  const project = {
    style: overrides.style ?? null,
    geminiBookState: overrides.geminiBookState ?? 'READY',
    geminiBookFileUri: overrides.geminiBookFileUri ?? 'gemini://book-1',
  }
  return {
    project,
    persist: vi.fn().mockResolvedValue(overrides.persist ?? true),
    repository: {
      findForExecution: vi.fn().mockResolvedValue(project),
      persist: vi.fn(async (input: { style: string }) => {
        if (overrides.persist ?? true) project.style = input.style
        return overrides.persist ?? true
      }),
    } as unknown as StyleRepository,
  }
}

function executorInput(overrides: Partial<{
  isRetry: boolean
  manualStyle: unknown
}> = {}) {
  return {
    userId: 'user-1',
    projectId: 'project-1',
    step: PIPELINE_STEPS.STYLE,
    startedAt,
    isRetry: false,
    retryCompletedStep: null,
    retryRunningStep: null,
    manualStyle: undefined,
    ...overrides,
  }
}

describe('StyleStepExecutor', () => {
  it('persists a valid AI STYLE using the persisted Gemini file URI', async () => {
    const styles = makeRepository()
    const gemini: GeminiStyleAdapter = {
      generateStyle: vi.fn().mockResolvedValue({
        style: 'Watercolor storybook illustration with warm hand-painted texture.',
      }),
    }
    const executor = new StyleStepExecutor(styles.repository, gemini)

    await executor.execute(executorInput())

    expect(gemini.generateStyle).toHaveBeenCalledOnce()
    expect(gemini.generateStyle).toHaveBeenCalledWith({
      bookFileUri: 'gemini://book-1',
    })
    expect(styles.repository.persist).toHaveBeenCalledWith(expect.objectContaining({
      style: 'Watercolor storybook illustration with warm hand-painted texture.',
    }))
  })

  it('persists a short manual STYLE without calling Gemini', async () => {
    const styles = makeRepository()
    const gemini: GeminiStyleAdapter = { generateStyle: vi.fn() }
    const executor = new StyleStepExecutor(styles.repository, gemini)

    await executor.execute(executorInput({ manualStyle: 'watercolor' }))

    expect(gemini.generateStyle).not.toHaveBeenCalled()
    expect(styles.repository.persist).toHaveBeenCalledWith(expect.objectContaining({
      style: 'watercolor',
    }))
  })

  it('treats blank manual STYLE as the AI path', async () => {
    const styles = makeRepository()
    const gemini: GeminiStyleAdapter = {
      generateStyle: vi.fn().mockResolvedValue({
        style: 'Watercolor storybook illustration with warm hand-painted texture.',
      }),
    }
    const executor = new StyleStepExecutor(styles.repository, gemini)

    await executor.execute(executorInput({ manualStyle: '  ' }))

    expect(gemini.generateStyle).toHaveBeenCalledOnce()
  })

  it('does not call Gemini or persist invalid generated output', async () => {
    const styles = makeRepository()
    const gemini: GeminiStyleAdapter = {
      generateStyle: vi.fn().mockResolvedValue({ style: 'too short' }),
    }
    const executor = new StyleStepExecutor(styles.repository, gemini)

    await expect(executor.execute(executorInput())).rejects.toBeDefined()

    expect(gemini.generateStyle).toHaveBeenCalledOnce()
    expect(styles.repository.persist).not.toHaveBeenCalled()
  })

  it('fails before Gemini when the book reference is not READY', async () => {
    const styles = makeRepository({ geminiBookState: 'FAILED' })
    const gemini: GeminiStyleAdapter = { generateStyle: vi.fn() }
    const executor = new StyleStepExecutor(styles.repository, gemini)

    await expect(executor.execute(executorInput())).rejects.toMatchObject({
      statusCode: 409,
    })

    expect(gemini.generateStyle).not.toHaveBeenCalled()
    expect(styles.repository.persist).not.toHaveBeenCalled()
  })

  it('only reuses a persisted STYLE checkpoint on an explicit retry', async () => {
    const styles = makeRepository({
      style: 'Watercolor storybook illustration with warm hand-painted texture.',
    })
    const gemini: GeminiStyleAdapter = { generateStyle: vi.fn() }
    const executor = new StyleStepExecutor(styles.repository, gemini)

    await executor.execute(executorInput({ isRetry: true }))

    expect(gemini.generateStyle).not.toHaveBeenCalled()
    expect(styles.repository.persist).not.toHaveBeenCalled()
  })

  it('does not treat a persisted STYLE as a checkpoint on a new execution', async () => {
    const styles = makeRepository({
      style: 'Watercolor storybook illustration with warm hand-painted texture.',
    })
    const gemini: GeminiStyleAdapter = {
      generateStyle: vi.fn().mockResolvedValue({
        style: 'Ink and watercolor storybook illustration with soft paper grain.',
      }),
    }
    const executor = new StyleStepExecutor(styles.repository, gemini)

    await executor.execute(executorInput())

    expect(gemini.generateStyle).toHaveBeenCalledOnce()
  })

  it('surfaces a STYLE persistence failure after Gemini succeeds', async () => {
    const styles = makeRepository({ persist: false })
    const gemini: GeminiStyleAdapter = {
      generateStyle: vi.fn().mockResolvedValue({
        style: 'Watercolor storybook illustration with warm hand-painted texture.',
      }),
    }
    const executor = new StyleStepExecutor(styles.repository, gemini)

    await expect(executor.execute(executorInput())).rejects.toMatchObject({
      statusCode: 500,
    })
  })
})
