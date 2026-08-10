import { randomUUID } from 'node:crypto'

import type { GeminiCharactersAdapter } from '../../../services/gemini/gemini-characters-adapter.js'
import { manualStyleSchema } from '../style/style.schema.js'
import { PIPELINE_STEPS } from '../pipeline.constants.js'
import { PipelineError } from '../pipeline.errors.js'
import type { PipelineExecutor } from '../pipeline.service.js'
import { generatedCharactersSchema, persistedCharacterSchema } from './characters.schema.js'
import { CharactersRepository } from './characters.repository.js'

const PREREQUISITE_ERROR = 'STYLE and Gemini book initialization are required before CHARACTERS can run.'
const PERSISTENCE_ERROR = 'CHARACTERS could not be persisted.'

export class CharactersStepExecutor implements PipelineExecutor {
  constructor(
    private readonly characters: CharactersRepository,
    private readonly gemini: GeminiCharactersAdapter,
  ) {}

  async execute(input: Parameters<PipelineExecutor['execute']>[0]): Promise<void> {
    if (input.step !== PIPELINE_STEPS.CHARACTERS) {
      throw new Error('This pipeline step is not implemented.')
    }
    const project = await this.characters.findForExecution(input.projectId, input.userId)
    if (!project) throw new PipelineError('Project not found.', 404)

    if (this.isCheckpoint(input, project)) return
    const style = manualStyleSchema.safeParse(project.style)
    if (
      project.completedStep !== PIPELINE_STEPS.STYLE ||
      !style.success ||
      project.geminiBookState !== 'READY' ||
      project.geminiBookFileUri === null
    ) {
      throw new PipelineError(PREREQUISITE_ERROR, 409)
    }

    const generated = generatedCharactersSchema.parse(
      await this.gemini.generateCharacters({
        bookFileUri: project.geminiBookFileUri,
        style: style.data,
      }),
    )
    const persisted = await this.characters.replaceForAcquiredRun({
      projectId: input.projectId,
      userId: input.userId,
      startedAt: input.startedAt,
      characters: generated.characters.map((character, position) => ({
        id: randomUUID(), name: character.name, prompt: character.prompt, position,
      })),
    })
    if (!persisted) throw new PipelineError(PERSISTENCE_ERROR, 500)
  }

  private isCheckpoint(
    input: Parameters<PipelineExecutor['execute']>[0],
    project: Awaited<ReturnType<CharactersRepository['findForExecution']>> & {},
  ): boolean {
    if (
      !input.isRetry ||
      input.retryCompletedStep !== PIPELINE_STEPS.STYLE ||
      input.retryRunningStep !== PIPELINE_STEPS.CHARACTERS ||
      !project
    ) return false
    if (project.characters.length < 1 || project.characters.length > 2) return false
    return project.characters.every((character, position) =>
      character.position === position &&
      persistedCharacterSchema.safeParse(character).success,
    )
  }
}
