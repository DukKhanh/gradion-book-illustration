import { PipelineError } from '../pipeline.errors.js'
import { PIPELINE_STEPS } from '../pipeline.constants.js'
import type { PipelineExecutor } from '../pipeline.service.js'
import type { StyleGenerator } from './style-generator.port.js'
import { generatedStyleSchema, manualStyleSchema } from './style.schema.js'
import { StyleRepository } from './style.repository.js'

const BOOK_REFERENCE_ERROR = 'Gemini book initialization is required before STYLE can run.'
const STYLE_PERSISTENCE_ERROR = 'STYLE could not be persisted.'

export class StyleStepExecutor implements PipelineExecutor {
  constructor(
    private readonly styles: StyleRepository,
    private readonly gemini: StyleGenerator,
  ) {}

  async execute(input: Parameters<PipelineExecutor['execute']>[0]): Promise<void> {
    if (input.step !== PIPELINE_STEPS.STYLE) {
      throw new Error('This pipeline step is not implemented.')
    }

    const project = await this.styles.findForExecution(
      input.projectId,
      input.userId,
    )
    if (!project) {
      throw new PipelineError('Project not found.', 404)
    }

    const manualStyle = this.parseManualStyle(input.manualStyle)
    if (manualStyle !== undefined) {
      await this.persist(input, manualStyle)
      return
    }

    if (input.isRetry && this.isValidCheckpoint(project.style)) {
      return
    }

    if (
      project.geminiBookState !== 'READY' ||
      project.geminiBookFileUri === null
    ) {
      throw new PipelineError(BOOK_REFERENCE_ERROR, 409)
    }

    const generated = generatedStyleSchema.parse(
      await this.gemini.generateStyle({
        bookFileUri: project.geminiBookFileUri,
      }),
    )
    await this.persist(input, generated.style)
  }

  private parseManualStyle(value: unknown): string | undefined {
    if (value === undefined) {
      return undefined
    }
    if (typeof value === 'string' && value.trim() === '') {
      return undefined
    }
    return manualStyleSchema.parse(value)
  }

  private isValidCheckpoint(value: string | null): value is string {
    return generatedStyleSchema.safeParse({ style: value }).success
  }

  private async persist(
    input: Parameters<PipelineExecutor['execute']>[0],
    style: string,
  ): Promise<void> {
    const persisted = await this.styles.persist({
      projectId: input.projectId,
      userId: input.userId,
      startedAt: input.startedAt,
      style,
    })
    if (!persisted) {
      throw new PipelineError(STYLE_PERSISTENCE_ERROR, 500)
    }
  }
}
