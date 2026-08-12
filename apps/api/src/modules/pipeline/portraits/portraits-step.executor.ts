import { manualStyleSchema } from '../style/style.schema.js'
import { PIPELINE_STEPS } from '../pipeline.constants.js'
import { PipelineError } from '../pipeline.errors.js'
import type { PipelineExecutor } from '../pipeline.service.js'
import type { PortraitGenerator } from './portrait-generator.port.js'
import { PortraitsRepository, type PortraitProject } from './portraits.repository.js'

const PREREQUISITE_ERROR = 'CHARACTERS and STYLE are required before PORTRAITS can run.'
const PORTRAIT_ERROR = 'Portrait generation failed.'

export interface PortraitStorage {
  writePortrait(input: { userId: string, projectId: string, characterId: string, stepStartedAt: Date, bytes: Uint8Array }): Promise<string>
  portraitExists(path: string): Promise<boolean>
  deletePortrait(path: string): Promise<void>
}

export class PortraitsStepExecutor implements PipelineExecutor {
  constructor(
    private readonly portraits: PortraitsRepository,
    private readonly gemini: PortraitGenerator,
    private readonly storage: PortraitStorage,
  ) {}

  async execute(input: Parameters<PipelineExecutor['execute']>[0]): Promise<void> {
    if (input.step !== PIPELINE_STEPS.PORTRAITS) throw new Error('This pipeline step is not implemented.')
    const project = await this.portraits.findForExecution(input.projectId, input.userId)
    if (!project) throw new PipelineError('Project not found.', 404)
    const style = manualStyleSchema.safeParse(project.style)
    if (project.completedStep !== PIPELINE_STEPS.CHARACTERS || !style.success || !this.validCharacters(project)) {
      throw new PipelineError(PREREQUISITE_ERROR, 409)
    }

    for (const character of project.characters) {
      if (await this.isDurable(character)) continue
      const begun = await this.portraits.beginPortrait({ ...input, characterId: character.id })
      if (!begun) throw new PipelineError('PORTRAITS execution is no longer current.', 500)
      let imagePath: string | undefined
      try {
        const image = await this.gemini.generatePortrait({
          characterName: character.name, characterPrompt: character.prompt, style: style.data,
        })
        if (image.mimeType !== 'image/jpeg' || image.bytes.length === 0) throw new Error('Invalid portrait image.')
        imagePath = await this.storage.writePortrait({
          userId: input.userId, projectId: input.projectId, characterId: character.id,
          stepStartedAt: input.startedAt, bytes: image.bytes,
        })
        const completed = await this.portraits.completePortrait({ ...input, characterId: character.id, imagePath })
        if (!completed) {
          try { await this.storage.deletePortrait(imagePath) } catch { /* orphan is inaccessible */ }
          throw new PipelineError('Portrait checkpoint could not be persisted.', 500)
        }
      } catch (error) {
        if (error instanceof PipelineError) throw error
        console.error('Portrait generation failed.', {
          projectId: input.projectId,
          characterId: character.id,
          error: error instanceof Error ? error.message : String(error),
        })
        if (imagePath) {
          try { await this.storage.deletePortrait(imagePath) } catch { /* orphan is inaccessible */ }
        }
        const failed = await this.portraits.failPortrait({ ...input, characterId: character.id, error: PORTRAIT_ERROR })
        if (!failed) throw new PipelineError('Portrait failure could not be persisted.', 500)
        throw new Error(PORTRAIT_ERROR)
      }
    }
  }

  private validCharacters(project: PortraitProject): boolean {
    return project.characters.length >= 1 && project.characters.length <= 2 && project.characters.every((character, position) =>
      character.position === position && character.name.trim().length > 0 && character.prompt.trim().split(/\s+/).filter(Boolean).length >= 50,
    )
  }

  private async isDurable(character: PortraitProject['characters'][number]): Promise<boolean> {
    return character.generationStatus === 'DONE' && character.imagePath !== null && await this.storage.portraitExists(character.imagePath)
  }
}
