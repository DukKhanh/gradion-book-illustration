import {
  and,
  desc,
  eq,
  asc,
} from 'drizzle-orm'

import { db } from '../../db/client.js'
import { characters, projects } from '../../db/schema.js'

export type ProjectRecord = typeof projects.$inferSelect
export type ProjectCharacterRecord = typeof characters.$inferSelect

export class ProjectRepository {
  constructor(private readonly database: typeof db = db) {}

  async create(project: typeof projects.$inferInsert): Promise<ProjectRecord> {
    const [created] = await this.database
      .insert(projects)
      .values(project)
      .returning()
    if (!created) {
      throw new Error('Project insert did not return a project.')
    }
    return created
  }

  async listByUserId(userId: string): Promise<ProjectRecord[]> {
    return this.database
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.createdAt))
  }

  async findByIdForUser(
    projectId: string,
    userId: string,
  ): Promise<ProjectRecord | null> {
    const [project] = await this.database
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.userId, userId),
        ),
      )
    return project ?? null
  }

  async listCharactersForProjectForUser(
    projectId: string,
    userId: string,
  ): Promise<ProjectCharacterRecord[]> {
    return this.database.select({
      id: characters.id,
      projectId: characters.projectId,
      name: characters.name,
      prompt: characters.prompt,
      imagePath: characters.imagePath,
      generationStatus: characters.generationStatus,
      generationError: characters.generationError,
      position: characters.position,
      createdAt: characters.createdAt,
      updatedAt: characters.updatedAt,
    }).from(characters).innerJoin(
      projects,
      eq(characters.projectId, projects.id),
    ).where(and(
      eq(projects.id, projectId),
      eq(projects.userId, userId),
    )).orderBy(asc(characters.position))
  }
}
