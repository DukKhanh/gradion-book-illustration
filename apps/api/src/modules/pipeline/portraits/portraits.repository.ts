import { and, asc, eq, exists } from 'drizzle-orm'

import { db } from '../../../db/client.js'
import { characters, projects } from '../../../db/schema.js'
import { PIPELINE_STEPS, STEP_STATES } from '../pipeline.constants.js'

export type PortraitProject = {
  completedStep: string | null
  style: string | null
  characters: Array<{
    id: string
    name: string
    prompt: string
    position: number
    imagePath: string | null
    generationStatus: string
    generationError: string | null
  }>
}

export class PortraitsRepository {
  constructor(private readonly database: typeof db = db) {}

  async findForExecution(projectId: string, userId: string): Promise<PortraitProject | null> {
    const [project] = await this.database.select({
      completedStep: projects.completedStep, style: projects.style,
    }).from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    if (!project) return null
    const stored = await this.database.select({
      id: characters.id, name: characters.name, prompt: characters.prompt,
      position: characters.position, imagePath: characters.imagePath,
      generationStatus: characters.generationStatus, generationError: characters.generationError,
    }).from(characters).where(eq(characters.projectId, projectId)).orderBy(asc(characters.position))
    return { ...project, characters: stored }
  }

  async beginPortrait(input: RunCharacterInput): Promise<boolean> {
    const updated = await this.database.update(characters).set({
      generationStatus: 'RUNNING', generationError: null, imagePath: null, updatedAt: new Date(),
    }).where(and(eq(characters.id, input.characterId), eq(characters.projectId, input.projectId), this.ownsRun(input)))
      .returning({ id: characters.id })
    return updated.length === 1
  }

  async completePortrait(input: RunCharacterInput & { imagePath: string }): Promise<boolean> {
    const updated = await this.database.update(characters).set({
      generationStatus: 'DONE', generationError: null, imagePath: input.imagePath, updatedAt: new Date(),
    }).where(and(eq(characters.id, input.characterId), eq(characters.projectId, input.projectId), this.ownsRun(input)))
      .returning({ id: characters.id })
    return updated.length === 1
  }

  async failPortrait(input: RunCharacterInput & { error: string }): Promise<boolean> {
    const updated = await this.database.update(characters).set({
      generationStatus: 'FAILED', generationError: input.error, imagePath: null, updatedAt: new Date(),
    }).where(and(eq(characters.id, input.characterId), eq(characters.projectId, input.projectId), this.ownsRun(input)))
      .returning({ id: characters.id })
    return updated.length === 1
  }

  async findCompletedForUser(input: { projectId: string, userId: string, characterId: string }) {
    const [portrait] = await this.database.select({ imagePath: characters.imagePath }).from(characters)
      .innerJoin(projects, eq(characters.projectId, projects.id)).where(and(
        eq(projects.id, input.projectId), eq(projects.userId, input.userId),
        eq(characters.id, input.characterId), eq(characters.generationStatus, 'DONE'),
      ))
    return portrait?.imagePath ?? null
  }

  private ownsRun(input: RunCharacterInput) {
    return exists(this.database.select({ id: projects.id }).from(projects).where(and(
      eq(projects.id, input.projectId), eq(projects.userId, input.userId),
      eq(projects.runningStep, PIPELINE_STEPS.PORTRAITS),
      eq(projects.stepState, STEP_STATES.RUNNING),
      eq(projects.stepStartedAt, input.startedAt),
    )))
  }
}

type RunCharacterInput = {
  projectId: string
  userId: string
  characterId: string
  startedAt: Date
}
