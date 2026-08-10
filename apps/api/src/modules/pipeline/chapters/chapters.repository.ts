import { and, asc, eq } from 'drizzle-orm'

import { db } from '../../../db/client.js'
import { characters, chapters, projects } from '../../../db/schema.js'
import { PIPELINE_STEPS, STEP_STATES } from '../pipeline.constants.js'

export type ChaptersProject = {
  completedStep: string | null
  style: string | null
  geminiBookState: string
  geminiBookFileUri: string | null
  characters: Array<{
    id: string
    name: string
    prompt: string
    position: number
    generationStatus: string
    generationError: string | null
    imagePath: string | null
  }>
  chapters: Array<{
    name: string
    prompt: string
    characterIdsJson: string | null
    position: number
    generationStatus: string
    generationError: string | null
    imagePath: string | null
  }>
}

export class ChaptersRepository {
  constructor(private readonly database: typeof db = db) {}

  async findForExecution(projectId: string, userId: string): Promise<ChaptersProject | null> {
    const [project] = await this.database.select({
      completedStep: projects.completedStep, style: projects.style,
      geminiBookState: projects.geminiBookState, geminiBookFileUri: projects.geminiBookFileUri,
    }).from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    if (!project) return null
    const storedCharacters = await this.database.select({
      id: characters.id, name: characters.name, prompt: characters.prompt, position: characters.position,
      generationStatus: characters.generationStatus, generationError: characters.generationError,
      imagePath: characters.imagePath,
    }).from(characters).where(eq(characters.projectId, projectId)).orderBy(asc(characters.position))
    const storedChapters = await this.database.select({
      name: chapters.name, prompt: chapters.prompt, characterIdsJson: chapters.characterIdsJson,
      position: chapters.position, generationStatus: chapters.generationStatus,
      generationError: chapters.generationError, imagePath: chapters.imagePath,
    }).from(chapters).where(eq(chapters.projectId, projectId)).orderBy(asc(chapters.position))
    return { ...project, characters: storedCharacters, chapters: storedChapters }
  }

  async replaceForAcquiredRun(input: {
    projectId: string
    userId: string
    startedAt: Date
    chapter: { id: string, name: string, prompt: string, characterIdsJson: string, position: 0 }
  }): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const guarded = await transaction.update(projects).set({ updatedAt: new Date() }).where(and(
        eq(projects.id, input.projectId), eq(projects.userId, input.userId),
        eq(projects.runningStep, PIPELINE_STEPS.CHAPTERS),
        eq(projects.stepState, STEP_STATES.RUNNING),
        eq(projects.stepStartedAt, input.startedAt),
      )).returning({ id: projects.id })
      if (guarded.length !== 1) return false

      await transaction.delete(chapters).where(eq(chapters.projectId, input.projectId))
      await transaction.insert(chapters).values({
        ...input.chapter, projectId: input.projectId, generationStatus: 'PENDING',
        generationError: null, imagePath: null, createdAt: new Date(), updatedAt: new Date(),
      })
      return true
    })
  }
}
