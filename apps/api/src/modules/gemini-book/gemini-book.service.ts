import { HttpError } from '../../shared/http-error.js'
import type { GeminiBookAdapter } from '../../services/gemini/gemini-book-adapter.js'

export type GeminiBookState = 'IDLE' | 'RUNNING' | 'FAILED' | 'READY'

export type GeminiBookProject = {
  id: string
  bookFilePath: string
  geminiBookFileUri: string | null
  geminiBookState: GeminiBookState
  geminiBookStartedAt: Date | null
  geminiBookError: string | null
}

export interface GeminiBookRepository {
  findByIdForUser(projectId: string, userId: string): Promise<GeminiBookProject | null>
  acquire(input: {
    projectId: string
    userId: string
    expected: GeminiBookProject
    startedAt: Date
  }): Promise<boolean>
  complete(input: {
    projectId: string
    userId: string
    startedAt: Date
    fileUri: string
  }): Promise<boolean>
  fail(input: {
    projectId: string
    userId: string
    startedAt: Date
    error: string
  }): Promise<boolean>
  recoverStale(input: {
    projectId: string
    userId: string
    staleBefore: Date
    error: string
  }): Promise<boolean>
}

export interface GeminiBookStorage {
  readBook(bookPath: string): Promise<string>
}

type GeminiBookServiceOptions = {
  apiKey: string | undefined
  staleAfterMs: number
  now?: () => Date
}

const FAILED_ERROR = 'Gemini book preparation failed.'
const STALE_ERROR = 'Gemini book preparation timed out and can be retried.'

export class GeminiBookService {
  private readonly now: () => Date

  constructor(
    private readonly repository: GeminiBookRepository,
    private readonly storage: GeminiBookStorage,
    private readonly adapter: GeminiBookAdapter,
    private readonly options: GeminiBookServiceOptions,
  ) {
    this.now = options.now ?? (() => new Date())
  }

  async initialize(userId: string, projectId: string): Promise<void> {
    const project = await this.requireProject(userId, projectId)
    if (project.geminiBookState === 'READY') {
      if (project.geminiBookFileUri) {
        return
      }
      throw new HttpError('Gemini book state is invalid.', 409)
    }
    if (project.geminiBookState === 'RUNNING') {
      throw new HttpError('Gemini book preparation is already running.', 409)
    }
    if (!this.options.apiKey?.trim()) {
      throw new HttpError('Gemini is not configured.', 503)
    }

    const startedAt = this.now()
    const acquired = await this.repository.acquire({
      projectId,
      userId,
      expected: project,
      startedAt,
    })
    if (!acquired) {
      throw new HttpError('Gemini book state changed before initialization.', 409)
    }

    try {
      const content = await this.storage.readBook(project.bookFilePath)
      const uploaded = await this.adapter.uploadBook({
        content,
        displayName: `${project.id}-book.txt`,
      })
      const completed = await this.repository.complete({
        projectId,
        userId,
        startedAt,
        fileUri: uploaded.uri,
      })
      if (!completed) {
        throw new HttpError(
          'Gemini book readiness could not be persisted.',
          500,
        )
      }
    } catch (error) {
      if (error instanceof HttpError) {
        throw error
      }
      let failed = false
      try {
        failed = await this.repository.fail({
          projectId,
          userId,
          startedAt,
          error: FAILED_ERROR,
        })
      } catch {
        // The state transition failure is reported below.
      }
      if (!failed) {
        throw new HttpError(
          'Gemini book failure could not be persisted.',
          500,
        )
      }
      throw new HttpError(FAILED_ERROR, 502)
    }
  }

  async recoverStale(userId: string, projectId: string): Promise<void> {
    const project = await this.requireProject(userId, projectId)
    if (
      project.geminiBookState !== 'RUNNING' ||
      project.geminiBookStartedAt === null
    ) {
      throw new HttpError('There is no stale Gemini book preparation.', 409)
    }
    const recovered = await this.repository.recoverStale({
      projectId,
      userId,
      staleBefore: new Date(this.now().getTime() - this.options.staleAfterMs),
      error: STALE_ERROR,
    })
    if (!recovered) {
      throw new HttpError('There is no stale Gemini book preparation.', 409)
    }
  }

  private async requireProject(
    userId: string,
    projectId: string,
  ): Promise<GeminiBookProject> {
    const project = await this.repository.findByIdForUser(projectId, userId)
    if (!project) {
      throw new HttpError('Project not found.', 404)
    }
    return project
  }
}
