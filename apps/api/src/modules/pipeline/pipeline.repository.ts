import {
  and,
  eq,
  isNull,
  isNotNull,
  lt,
} from 'drizzle-orm'

import { db } from '../../db/client.js'
import { projects } from '../../db/schema.js'
import {
  STEP_STATES,
} from './pipeline.constants.js'
import type {
  PipelineProject,
  PipelineRepository as PipelineRepositoryContract,
} from './pipeline.service.js'
import type { PipelineStep } from './pipeline.types.js'

type StepValue = PipelineStep | null

function completedStepEquals(value: StepValue) {
  return value === null
    ? isNull(projects.completedStep)
    : eq(projects.completedStep, value)
}

function runningStepEquals(value: StepValue) {
  return value === null
    ? isNull(projects.runningStep)
    : eq(projects.runningStep, value)
}

export class PipelineRepository
  implements PipelineRepositoryContract
{
  constructor(private readonly database: typeof db = db) {}

  async findById(
    projectId: string,
  ): Promise<PipelineProject | null> {
    const [project] = await this.database
      .select({
        id: projects.id,
        completedStep: projects.completedStep,
        runningStep: projects.runningStep,
        stepState: projects.stepState,
        stepStartedAt: projects.stepStartedAt,
        stepError: projects.stepError,
      })
      .from(projects)
      .where(eq(projects.id, projectId))

    return project
      ? {
          ...project,
          completedStep: project.completedStep as StepValue,
          runningStep: project.runningStep as StepValue,
          stepState: project.stepState as PipelineProject['stepState'],
        }
      : null
  }

  async acquireStep(input: {
    projectId: string
    step: PipelineStep
    expected: PipelineProject
    startedAt: Date
  }): Promise<boolean> {
    const updated = await this.database
      .update(projects)
      .set({
        runningStep: input.step,
        stepState: STEP_STATES.RUNNING,
        stepStartedAt: input.startedAt,
        stepError: null,
        updatedAt: input.startedAt,
      })
      .where(
        and(
          eq(projects.id, input.projectId),
          completedStepEquals(input.expected.completedStep),
          runningStepEquals(input.expected.runningStep),
          eq(projects.stepState, input.expected.stepState),
          input.expected.stepStartedAt === null
            ? isNull(projects.stepStartedAt)
            : eq(
                projects.stepStartedAt,
                input.expected.stepStartedAt,
              ),
        ),
      )
      .returning({ id: projects.id })

    return updated.length === 1
  }

  async completeStep(input: {
    projectId: string
    step: PipelineStep
    startedAt: Date
  }): Promise<boolean> {
    const updated = await this.database
      .update(projects)
      .set({
        completedStep: input.step,
        runningStep: null,
        stepState: STEP_STATES.IDLE,
        stepStartedAt: null,
        stepError: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projects.id, input.projectId),
          eq(projects.runningStep, input.step),
          eq(projects.stepState, STEP_STATES.RUNNING),
          eq(projects.stepStartedAt, input.startedAt),
        ),
      )
      .returning({ id: projects.id })

    return updated.length === 1
  }

  async failStep(input: {
    projectId: string
    step: PipelineStep
    startedAt: Date
    error: string
  }): Promise<boolean> {
    const updated = await this.database
      .update(projects)
      .set({
        stepState: STEP_STATES.FAILED,
        stepStartedAt: null,
        stepError: input.error,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projects.id, input.projectId),
          eq(projects.runningStep, input.step),
          eq(projects.stepState, STEP_STATES.RUNNING),
          eq(projects.stepStartedAt, input.startedAt),
        ),
      )
      .returning({ id: projects.id })

    return updated.length === 1
  }

  async recoverStaleStep(input: {
    projectId: string
    staleBefore: Date
    error: string
  }): Promise<boolean> {
    const updated = await this.database
      .update(projects)
      .set({
        stepState: STEP_STATES.FAILED,
        stepStartedAt: null,
        stepError: input.error,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projects.id, input.projectId),
          eq(projects.stepState, STEP_STATES.RUNNING),
          isNotNull(projects.runningStep),
          lt(projects.stepStartedAt, input.staleBefore),
        ),
      )
      .returning({ id: projects.id })

    return updated.length === 1
  }
}
