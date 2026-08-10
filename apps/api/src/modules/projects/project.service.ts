import { randomUUID } from 'node:crypto'

import { z } from 'zod'

import { HttpError } from '../../shared/http-error.js'
import { FileStorageService } from '../../storage/file-storage.service.js'
import type { ProjectRecord } from './project.repository.js'
import { ProjectRepository } from './project.repository.js'

const titleSchema = z.string().trim().min(1).max(200)
const MAX_BOOK_BYTES = 1_000_000

export type ProjectDto = {
  id: string
  title: string
  createdAt: Date
  updatedAt: Date
  style: string | null
  pipeline: {
    completedStep: string | null
    runningStep: string | null
    stepState: string
    stepStartedAt: Date | null
    stepError: string | null
  }
}

export class ProjectService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly storage: FileStorageService,
  ) {}

  async create(input: {
    userId: string
    title: unknown
    bookText: unknown
    upload?: Express.Multer.File
  }): Promise<ProjectDto> {
    const title = titleSchema.safeParse(input.title)
    if (!title.success) {
      throw new HttpError('A project title is required.', 400)
    }

    const bookText = this.resolveBookText(input.bookText, input.upload)
    const projectId = randomUUID()
    const createdAt = new Date()
    const bookFilePath = await this.storage.writeBook({
      userId: input.userId,
      projectId,
      content: bookText,
    })

    try {
      const project = await this.projects.create({
        id: projectId,
        userId: input.userId,
        title: title.data,
        bookFilePath,
        createdAt,
        updatedAt: createdAt,
      })
      return toProjectDto(project)
    } catch {
      try {
        await this.storage.deleteBook(bookFilePath)
      } catch {
        // No background cleanup is needed for a best-effort rollback.
      }
      throw new HttpError('Could not create project.', 500)
    }
  }

  async list(userId: string): Promise<ProjectDto[]> {
    return (await this.projects.listByUserId(userId)).map(toProjectDto)
  }

  async detail(userId: string, projectId: string): Promise<ProjectDto> {
    const project = await this.projects.findByIdForUser(projectId, userId)
    if (!project) {
      throw new HttpError('Project not found.', 404)
    }
    return toProjectDto(project)
  }

  private resolveBookText(
    rawBookText: unknown,
    upload: Express.Multer.File | undefined,
  ): string {
    if (rawBookText !== undefined && typeof rawBookText !== 'string') {
      throw new HttpError('Book text is invalid.', 400)
    }

    const pasted = rawBookText ?? ''
    const hasPasted = rawBookText !== undefined
    const hasUpload = upload !== undefined

    if (hasPasted === hasUpload) {
      throw new HttpError(
        'Provide exactly one pasted book text or .txt upload.',
        400,
      )
    }

    if (hasPasted) {
      if (pasted.trim().length === 0) {
        throw new HttpError('Book text cannot be empty.', 400)
      }
      if (Buffer.byteLength(pasted, 'utf8') > MAX_BOOK_BYTES) {
        throw new HttpError('Book text is too large.', 400)
      }
      return pasted
    }

    if (!upload || !upload.originalname.toLowerCase().endsWith('.txt')) {
      throw new HttpError('Upload a .txt book file.', 400)
    }
    if (upload.size === 0 || upload.size > MAX_BOOK_BYTES) {
      throw new HttpError('Book text is too large or empty.', 400)
    }

    const content = upload.buffer.toString('utf8')
    if (content.trim().length === 0) {
      throw new HttpError('Book text cannot be empty.', 400)
    }
    return content
  }
}

function toProjectDto(project: ProjectRecord): ProjectDto {
  return {
    id: project.id,
    title: project.title,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    style: project.style,
    pipeline: {
      completedStep: project.completedStep,
      runningStep: project.runningStep,
      stepState: project.stepState,
      stepStartedAt: project.stepStartedAt,
      stepError: project.stepError,
    },
  }
}
