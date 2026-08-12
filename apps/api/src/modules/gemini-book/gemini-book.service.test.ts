import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import type { GeminiBookAdapter } from '../../infrastructure/gemini/gemini-book-adapter.js'
import {
  GeminiBookService,
  type GeminiBookProject,
  type GeminiBookRepository,
  type GeminiBookStorage,
} from './gemini-book.service.js'

class InMemoryGeminiBookRepository
  implements GeminiBookRepository
{
  public completeResult = true
  public project: GeminiBookProject = {
    id: 'project-1',
    bookFilePath: '/books/project-1/book.txt',
    geminiBookFileUri: null,
    geminiBookState: 'IDLE',
    geminiBookStartedAt: null,
    geminiBookError: null,
  }

  async findByIdForUser(
    projectId: string,
    _userId: string,
  ): Promise<GeminiBookProject | null> {
    return projectId === this.project.id ? { ...this.project } : null
  }

  async acquire(input: {
    projectId: string
    userId: string
    expected: GeminiBookProject
    startedAt: Date
  }): Promise<boolean> {
    if (
      this.project.geminiBookState !== input.expected.geminiBookState ||
      this.project.geminiBookStartedAt?.getTime() !==
        input.expected.geminiBookStartedAt?.getTime()
    ) {
      return false
    }
    this.project = {
      ...this.project,
      geminiBookState: 'RUNNING',
      geminiBookStartedAt: input.startedAt,
      geminiBookError: null,
    }
    return true
  }

  async complete(input: {
    projectId: string
    userId: string
    startedAt: Date
    fileUri: string
  }): Promise<boolean> {
    if (!this.completeResult) {
      return false
    }
    this.project = {
      ...this.project,
      geminiBookFileUri: input.fileUri,
      geminiBookState: 'READY',
      geminiBookStartedAt: null,
      geminiBookError: null,
    }
    return true
  }

  async fail(input: {
    projectId: string
    userId: string
    startedAt: Date
    error: string
  }): Promise<boolean> {
    this.project = {
      ...this.project,
      geminiBookState: 'FAILED',
      geminiBookStartedAt: null,
      geminiBookError: input.error,
    }
    return true
  }

  async recoverStale(input: {
    projectId: string
    userId: string
    staleBefore: Date
    error: string
  }): Promise<boolean> {
    if (
      this.project.geminiBookState !== 'RUNNING' ||
      this.project.geminiBookStartedAt === null ||
      this.project.geminiBookStartedAt > input.staleBefore
    ) {
      return false
    }
    this.project = {
      ...this.project,
      geminiBookState: 'FAILED',
      geminiBookStartedAt: null,
      geminiBookError: input.error,
    }
    return true
  }
}

describe('GeminiBookService', () => {
  let repository: InMemoryGeminiBookRepository
  let adapter: GeminiBookAdapter
  let storage: GeminiBookStorage
  let service: GeminiBookService

  beforeEach(() => {
    repository = new InMemoryGeminiBookRepository()
    adapter = {
      uploadBook: vi.fn().mockResolvedValue({ uri: 'gemini://book-1' }),
    }
    storage = {
      readBook: vi.fn().mockResolvedValue('A stored book.'),
    }
    service = new GeminiBookService(repository, storage, adapter, {
      apiKey: 'test-key',
      staleAfterMs: 60_000,
      now: () => new Date('2026-08-11T10:00:00.000Z'),
    })
  })

  it('uploads once and persists a READY file URI', async () => {
    await service.initialize('user-1', 'project-1')

    expect(adapter.uploadBook).toHaveBeenCalledOnce()
    expect(repository.project).toMatchObject({
      geminiBookFileUri: 'gemini://book-1',
      geminiBookState: 'READY',
      geminiBookStartedAt: null,
    })
  })

  it('does not call Gemini again for a READY book', async () => {
    repository.project = {
      ...repository.project,
      geminiBookFileUri: 'gemini://book-1',
      geminiBookState: 'READY',
    }

    await service.initialize('user-1', 'project-1')
    expect(adapter.uploadBook).not.toHaveBeenCalled()
  })

  it('validates the API key before acquiring work', async () => {
    service = new GeminiBookService(repository, storage, adapter, {
      apiKey: undefined,
      staleAfterMs: 60_000,
    })

    await expect(service.initialize('user-1', 'project-1')).rejects
      .toMatchObject({ statusCode: 503 })
    expect(repository.project.geminiBookState).toBe('IDLE')
    expect(adapter.uploadBook).not.toHaveBeenCalled()
  })

  it('marks an upload failure as FAILED without retrying', async () => {
    adapter.uploadBook = vi.fn().mockRejectedValue(new Error('provider down'))

    await expect(service.initialize('user-1', 'project-1')).rejects
      .toMatchObject({ statusCode: 502 })
    expect(repository.project).toMatchObject({
      geminiBookState: 'FAILED',
      geminiBookError: 'Gemini book preparation failed.',
    })
  })

  it('fails safely when the local book cannot be read before upload', async () => {
    storage.readBook = vi.fn().mockRejectedValue(new Error('missing file'))

    await expect(service.initialize('user-1', 'project-1')).rejects
      .toMatchObject({
        statusCode: 502,
        message: 'Gemini book preparation failed.',
      })
    expect(adapter.uploadBook).not.toHaveBeenCalled()
    expect(repository.project).toMatchObject({
      geminiBookState: 'FAILED',
      geminiBookError: 'Gemini book preparation failed.',
    })
  })

  it('retries FAILED work only after another explicit initialization request', async () => {
    repository.project = {
      ...repository.project,
      geminiBookState: 'FAILED',
      geminiBookError: 'Gemini book preparation failed.',
    }

    await service.initialize('user-1', 'project-1')
    expect(adapter.uploadBook).toHaveBeenCalledOnce()
    expect(repository.project.geminiBookState).toBe('READY')
  })

  it('does not report success when the READY transition fails', async () => {
    repository.completeResult = false

    await expect(service.initialize('user-1', 'project-1')).rejects
      .toMatchObject({
        statusCode: 500,
        message: 'Gemini book readiness could not be persisted.',
      })
    expect(adapter.uploadBook).toHaveBeenCalledOnce()
    expect(repository.project).toMatchObject({
      geminiBookState: 'RUNNING',
      geminiBookStartedAt: new Date('2026-08-11T10:00:00.000Z'),
    })
  })

  it('recovers stale work explicitly without calling Gemini', async () => {
    repository.project = {
      ...repository.project,
      geminiBookState: 'RUNNING',
      geminiBookStartedAt: new Date('2026-08-11T09:58:00.000Z'),
    }

    await service.recoverStale('user-1', 'project-1')
    expect(repository.project.geminiBookState).toBe('FAILED')
    expect(adapter.uploadBook).not.toHaveBeenCalled()
  })

  it('rejects recovery for non-stale RUNNING work', async () => {
    repository.project = {
      ...repository.project,
      geminiBookState: 'RUNNING',
      geminiBookStartedAt: new Date('2026-08-11T09:59:30.000Z'),
    }

    await expect(service.recoverStale('user-1', 'project-1')).rejects
      .toMatchObject({ statusCode: 409 })
  })
})
