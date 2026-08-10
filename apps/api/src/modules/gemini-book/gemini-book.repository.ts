import {
  and,
  eq,
  inArray,
  isNull,
  lt,
} from 'drizzle-orm'

import { db } from '../../db/client.js'
import { projects } from '../../db/schema.js'
import type {
  GeminiBookProject,
  GeminiBookRepository as GeminiBookRepositoryContract,
} from './gemini-book.service.js'

export class GeminiBookRepository
  implements GeminiBookRepositoryContract
{
  constructor(private readonly database: typeof db = db) {}

  async findByIdForUser(
    projectId: string,
    userId: string,
  ): Promise<GeminiBookProject | null> {
    const [project] = await this.database
      .select({
        id: projects.id,
        bookFilePath: projects.bookFilePath,
        geminiBookFileUri: projects.geminiBookFileUri,
        geminiBookState: projects.geminiBookState,
        geminiBookStartedAt: projects.geminiBookStartedAt,
        geminiBookError: projects.geminiBookError,
      })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))

    return project
      ? {
          ...project,
          geminiBookState: project.geminiBookState as GeminiBookProject['geminiBookState'],
        }
      : null
  }

  async acquire(input: {
    projectId: string
    userId: string
    expected: GeminiBookProject
    startedAt: Date
  }): Promise<boolean> {
    const updated = await this.database
      .update(projects)
      .set({
        geminiBookState: 'RUNNING',
        geminiBookStartedAt: input.startedAt,
        geminiBookError: null,
        updatedAt: input.startedAt,
      })
      .where(and(
        eq(projects.id, input.projectId),
        eq(projects.userId, input.userId),
        inArray(projects.geminiBookState, ['IDLE', 'FAILED']),
        eq(projects.geminiBookState, input.expected.geminiBookState),
        input.expected.geminiBookStartedAt === null
          ? isNull(projects.geminiBookStartedAt)
          : eq(projects.geminiBookStartedAt, input.expected.geminiBookStartedAt),
        isNull(projects.geminiBookFileUri),
      ))
      .returning({ id: projects.id })
    return updated.length === 1
  }

  async complete(input: {
    projectId: string
    userId: string
    startedAt: Date
    fileUri: string
  }): Promise<boolean> {
    const updated = await this.database.update(projects).set({
      geminiBookFileUri: input.fileUri,
      geminiBookState: 'READY',
      geminiBookStartedAt: null,
      geminiBookError: null,
      updatedAt: new Date(),
    }).where(and(
      eq(projects.id, input.projectId),
      eq(projects.userId, input.userId),
      eq(projects.geminiBookState, 'RUNNING'),
      eq(projects.geminiBookStartedAt, input.startedAt),
    )).returning({ id: projects.id })
    return updated.length === 1
  }

  async fail(input: {
    projectId: string
    userId: string
    startedAt: Date
    error: string
  }): Promise<boolean> {
    const updated = await this.database.update(projects).set({
      geminiBookState: 'FAILED',
      geminiBookStartedAt: null,
      geminiBookError: input.error,
      updatedAt: new Date(),
    }).where(and(
      eq(projects.id, input.projectId),
      eq(projects.userId, input.userId),
      eq(projects.geminiBookState, 'RUNNING'),
      eq(projects.geminiBookStartedAt, input.startedAt),
    )).returning({ id: projects.id })
    return updated.length === 1
  }

  async recoverStale(input: {
    projectId: string
    userId: string
    staleBefore: Date
    error: string
  }): Promise<boolean> {
    const updated = await this.database.update(projects).set({
      geminiBookState: 'FAILED',
      geminiBookStartedAt: null,
      geminiBookError: input.error,
      updatedAt: new Date(),
    }).where(and(
      eq(projects.id, input.projectId),
      eq(projects.userId, input.userId),
      eq(projects.geminiBookState, 'RUNNING'),
      lt(projects.geminiBookStartedAt, input.staleBefore),
    )).returning({ id: projects.id })
    return updated.length === 1
  }
}
