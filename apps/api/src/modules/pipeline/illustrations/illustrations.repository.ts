import { and, asc, eq, exists } from 'drizzle-orm'

import { db } from '../../../db/client.js'
import { characters, chapters, projects } from '../../../db/schema.js'
import { PIPELINE_STEPS, STEP_STATES } from '../pipeline.constants.js'

export type IllustrationProject = {
  completedStep: string | null
  style: string | null
  characters: Array<{ id: string, name: string, prompt: string, position: number }>
  chapters: Array<{ id: string, name: string, prompt: string, characterIdsJson: string | null, imagePath: string | null, generationStatus: string, generationError: string | null, position: number }>
}

type RunInput = { projectId: string, userId: string, chapterId: string, startedAt: Date }

export class IllustrationsRepository {
  constructor(private readonly database: typeof db = db) {}

  async findForExecution(projectId: string, userId: string): Promise<IllustrationProject | null> {
    const [project] = await this.database.select({ completedStep: projects.completedStep, style: projects.style })
      .from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    if (!project) return null
    const storedCharacters = await this.database.select({ id: characters.id, name: characters.name, prompt: characters.prompt, position: characters.position })
      .from(characters).where(eq(characters.projectId, projectId)).orderBy(asc(characters.position))
    const storedChapters = await this.database.select({ id: chapters.id, name: chapters.name, prompt: chapters.prompt, characterIdsJson: chapters.characterIdsJson, imagePath: chapters.imagePath, generationStatus: chapters.generationStatus, generationError: chapters.generationError, position: chapters.position })
      .from(chapters).where(eq(chapters.projectId, projectId)).orderBy(asc(chapters.position))
    return { ...project, characters: storedCharacters, chapters: storedChapters }
  }

  async beginIllustration(input: RunInput): Promise<boolean> {
    const updated = await this.database.update(chapters).set({ generationStatus: 'RUNNING', generationError: null, imagePath: null, updatedAt: new Date() })
      .where(and(eq(chapters.id, input.chapterId), eq(chapters.projectId, input.projectId), this.ownsRun(input))).returning({ id: chapters.id })
    return updated.length === 1
  }

  async completeIllustration(input: RunInput & { imagePath: string }): Promise<boolean> {
    const updated = await this.database.update(chapters).set({ generationStatus: 'DONE', generationError: null, imagePath: input.imagePath, updatedAt: new Date() })
      .where(and(eq(chapters.id, input.chapterId), eq(chapters.projectId, input.projectId), this.ownsRun(input))).returning({ id: chapters.id })
    return updated.length === 1
  }

  async failIllustration(input: RunInput & { error: string }): Promise<boolean> {
    const updated = await this.database.update(chapters).set({ generationStatus: 'FAILED', generationError: input.error, imagePath: null, updatedAt: new Date() })
      .where(and(eq(chapters.id, input.chapterId), eq(chapters.projectId, input.projectId), this.ownsRun(input))).returning({ id: chapters.id })
    return updated.length === 1
  }

  async findCompletedForUser(input: { projectId: string, userId: string, chapterId: string }): Promise<string | null> {
    const [illustration] = await this.database.select({ imagePath: chapters.imagePath }).from(chapters).innerJoin(projects, eq(chapters.projectId, projects.id))
      .where(and(eq(projects.id, input.projectId), eq(projects.userId, input.userId), eq(chapters.id, input.chapterId), eq(chapters.generationStatus, 'DONE')))
    return illustration?.imagePath ?? null
  }

  private ownsRun(input: RunInput) {
    return exists(this.database.select({ id: projects.id }).from(projects).where(and(
      eq(projects.id, input.projectId), eq(projects.userId, input.userId),
      eq(projects.runningStep, PIPELINE_STEPS.ILLUSTRATIONS), eq(projects.stepState, STEP_STATES.RUNNING), eq(projects.stepStartedAt, input.startedAt),
    )))
  }
}
