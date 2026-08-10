import { and, eq } from 'drizzle-orm'

import { db } from '../../../db/client.js'
import { projects } from '../../../db/schema.js'
import { PIPELINE_STEPS, STEP_STATES } from '../pipeline.constants.js'

export type StyleProject = {
  style: string | null
  geminiBookState: string
  geminiBookFileUri: string | null
}

export class StyleRepository {
  constructor(private readonly database: typeof db = db) {}

  async findForExecution(
    projectId: string,
    userId: string,
  ): Promise<StyleProject | null> {
    const [project] = await this.database
      .select({
        style: projects.style,
        geminiBookState: projects.geminiBookState,
        geminiBookFileUri: projects.geminiBookFileUri,
      })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    return project ?? null
  }

  async persist(input: {
    projectId: string
    userId: string
    startedAt: Date
    style: string
  }): Promise<boolean> {
    const updated = await this.database
      .update(projects)
      .set({ style: input.style, updatedAt: new Date() })
      .where(and(
        eq(projects.id, input.projectId),
        eq(projects.userId, input.userId),
        eq(projects.runningStep, PIPELINE_STEPS.STYLE),
        eq(projects.stepState, STEP_STATES.RUNNING),
        eq(projects.stepStartedAt, input.startedAt),
      ))
      .returning({ id: projects.id })
    return updated.length === 1
  }
}
