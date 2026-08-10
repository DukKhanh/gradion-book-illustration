import {
  PIPELINE_STEP_SEQUENCE,
  PIPELINE_STEPS,
  STEP_STATES,
} from './pipeline.constants.js'
import { PipelineError } from './pipeline.errors.js'
import type {
  PipelineStep,
  StepState,
} from './pipeline.types.js'

export type PipelineProject = {
  id: string
  completedStep: PipelineStep | null
  runningStep: PipelineStep | null
  stepState: StepState
  stepStartedAt: Date | null
  stepError: string | null
}

export interface PipelineRepository {
  findByIdForUser(
    projectId: string,
    userId: string,
  ): Promise<PipelineProject | null>
  acquireStep(input: {
    projectId: string
    userId: string
    step: PipelineStep
    expected: PipelineProject
    startedAt: Date
  }): Promise<boolean>
  completeStep(input: {
    projectId: string
    userId: string
    step: PipelineStep
    startedAt: Date
  }): Promise<boolean>
  failStep(input: {
    projectId: string
    userId: string
    step: PipelineStep
    startedAt: Date
    error: string
  }): Promise<boolean>
  recoverStaleStep(input: {
    projectId: string
    userId: string
    staleBefore: Date
    error: string
  }): Promise<boolean>
}

export interface PipelineExecutor {
  execute(input: {
    projectId: string
    step: PipelineStep
  }): Promise<void>
}

type PipelineServiceOptions = {
  staleAfterMs: number
  now?: () => Date
}

const STALE_ERROR =
  'Pipeline execution timed out and can be retried.'
const EXECUTION_ERROR = 'Pipeline execution failed.'
const COMPLETION_PERSISTENCE_ERROR =
  'Pipeline completion could not be persisted.'
const FAILURE_PERSISTENCE_ERROR =
  'Pipeline failure could not be persisted.'

export class PipelineService {
  private readonly now: () => Date

  constructor(
    private readonly repository: PipelineRepository,
    private readonly executor: PipelineExecutor,
    options: PipelineServiceOptions,
  ) {
    this.now = options.now ?? (() => new Date())
    this.staleAfterMs = options.staleAfterMs
  }

  private readonly staleAfterMs: number

  async run(
    userId: string,
    projectId: string,
    step: PipelineStep,
  ): Promise<void> {
    const project = await this.requireProject(projectId, userId)
    this.assertCanRun(project, step)

    const startedAt = this.now()
    const acquired = await this.repository.acquireStep({
      projectId,
      userId,
      step,
      expected: project,
      startedAt,
    })

    if (!acquired) {
      throw new PipelineError(
        'The pipeline changed before this step could start.',
        409,
      )
    }

    try {
      await this.executor.execute({ projectId, step })
    } catch {
      let failed = false
      try {
        failed = await this.repository.failStep({
          projectId,
          userId,
          step,
          startedAt,
          error: EXECUTION_ERROR,
        })
      } catch {
        // The original executor error is intentionally not exposed.
      }

      if (!failed) {
        throw new PipelineError(FAILURE_PERSISTENCE_ERROR, 500)
      }

      throw new PipelineError(EXECUTION_ERROR, 502)
    }

    let completed = false
    try {
      completed = await this.repository.completeStep({
        projectId,
        userId,
        step,
        startedAt,
      })
    } catch {
      // The execution result must not be reported as complete.
    }

    if (!completed) {
      throw new PipelineError(COMPLETION_PERSISTENCE_ERROR, 500)
    }
  }

  async recoverStale(userId: string, projectId: string): Promise<void> {
    const project = await this.requireProject(projectId, userId)
    if (
      project.stepState !== STEP_STATES.RUNNING ||
      project.runningStep === null ||
      project.stepStartedAt === null
    ) {
      throw new PipelineError(
        'There is no stale pipeline step to recover.',
        409,
      )
    }

    const staleBefore = new Date(
      this.now().getTime() - this.staleAfterMs,
    )
    const recovered = await this.repository.recoverStaleStep({
      projectId,
      userId,
      staleBefore,
      error: STALE_ERROR,
    })

    if (!recovered) {
      throw new PipelineError(
        'There is no stale pipeline step to recover.',
        409,
      )
    }
  }

  private async requireProject(
    projectId: string,
    userId: string,
  ): Promise<PipelineProject> {
    const project = await this.repository.findByIdForUser(projectId, userId)
    if (!project) {
      throw new PipelineError('Project not found.', 404)
    }
    return project
  }

  private assertCanRun(
    project: PipelineProject,
    step: PipelineStep,
  ): void {
    const stepIndex = PIPELINE_STEP_SEQUENCE.indexOf(step)
    const completedIndex = project.completedStep === null
      ? -1
      : PIPELINE_STEP_SEQUENCE.indexOf(project.completedStep)

    if (stepIndex === -1 || completedIndex === -1 && project.completedStep) {
      throw new PipelineError('Pipeline state is invalid.', 409)
    }

    const previousStep = stepIndex === 0
      ? null
      : PIPELINE_STEP_SEQUENCE[stepIndex - 1]

    if (project.stepState === STEP_STATES.RUNNING) {
      throw new PipelineError('A pipeline step is already running.', 409)
    }

    if (project.stepState === STEP_STATES.FAILED) {
      if (
        project.runningStep !== step ||
        project.completedStep !== previousStep
      ) {
        throw new PipelineError(
          'Only the failed pipeline step can be retried.',
          409,
        )
      }
      return
    }

    if (
      project.stepState !== STEP_STATES.IDLE ||
      project.runningStep !== null ||
      project.completedStep !== previousStep
    ) {
      throw new PipelineError(
        'Pipeline steps must run in order.',
        409,
      )
    }
  }
}

export const unsupportedPipelineExecutor: PipelineExecutor = {
  async execute() {
    throw new Error('Gemini execution is not configured in Phase 4.')
  },
}

export { PIPELINE_STEPS }
