import { and, asc, eq } from 'drizzle-orm'

import { db } from '../../../db/client.js'
import { characters, projects } from '../../../db/schema.js'
import { PIPELINE_STEPS, STEP_STATES } from '../pipeline.constants.js'

export type CharactersProject = {
  completedStep: string | null
  style: string | null
  geminiBookState: string
  geminiBookFileUri: string | null
  characters: Array<{
    name: string
    prompt: string
    position: number
    generationStatus: string
    generationError: string | null
    imagePath: string | null
  }>
}

export class CharactersRepository {
  constructor(private readonly database: typeof db = db) {}

  async findForExecution(
    projectId: string,
    userId: string,
  ): Promise<CharactersProject | null> {
    const [project] = await this.database.select({
      completedStep: projects.completedStep,
      style: projects.style,
      geminiBookState: projects.geminiBookState,
      geminiBookFileUri: projects.geminiBookFileUri,
    }).from(projects).where(and(
      eq(projects.id, projectId), eq(projects.userId, userId),
    ))
    if (!project) return null
    const stored = await this.database.select({
      name: characters.name,
      prompt: characters.prompt,
      position: characters.position,
      generationStatus: characters.generationStatus,
      generationError: characters.generationError,
      imagePath: characters.imagePath,
    }).from(characters).where(eq(characters.projectId, projectId))
      .orderBy(asc(characters.position))
    return { ...project, characters: stored }
  }

  async replaceForAcquiredRun(input: {
    projectId: string
    userId: string
    startedAt: Date
    characters: Array<{ id: string, name: string, prompt: string, position: number }>
  }): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const guarded = await transaction.update(projects).set({
        updatedAt: new Date(),
      }).where(and(
        eq(projects.id, input.projectId),
        eq(projects.userId, input.userId),
        eq(projects.runningStep, PIPELINE_STEPS.CHARACTERS),
        eq(projects.stepState, STEP_STATES.RUNNING),
        eq(projects.stepStartedAt, input.startedAt),
      )).returning({ id: projects.id })
      if (guarded.length !== 1) return false

      await transaction.delete(characters).where(
        eq(characters.projectId, input.projectId),
      )
      await transaction.insert(characters).values(input.characters.map((character) => ({
        ...character,
        projectId: input.projectId,
        generationStatus: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      })))
      return true
    })
  }
}
