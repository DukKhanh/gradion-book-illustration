import { randomUUID } from 'node:crypto'

import type { ChapterGenerator } from './chapter-generator.port.js'
import { PIPELINE_STEPS } from '../pipeline.constants.js'
import { PipelineError } from '../pipeline.errors.js'
import type { PipelineExecutor } from '../pipeline.service.js'
import { manualStyleSchema } from '../style/style.schema.js'
import { ChaptersRepository, type ChaptersProject } from './chapters.repository.js'
import { generatedChapterSchema, persistedChapterSchema } from './chapters.schema.js'

const PREREQUISITE_ERROR = 'PORTRAITS, STYLE, and Gemini book initialization are required before CHAPTERS can run.'
const PERSISTENCE_ERROR = 'CHAPTERS could not be persisted.'

export class ChaptersStepExecutor implements PipelineExecutor {
  constructor(
    private readonly chapters: ChaptersRepository,
    private readonly gemini: ChapterGenerator,
  ) {}

  async execute(input: Parameters<PipelineExecutor['execute']>[0]): Promise<void> {
    if (input.step !== PIPELINE_STEPS.CHAPTERS) throw new Error('This pipeline step is not implemented.')
    const project = await this.chapters.findForExecution(input.projectId, input.userId)
    if (!project) throw new PipelineError('Project not found.', 404)
    if (this.isCheckpoint(input, project)) return

    const style = manualStyleSchema.safeParse(project.style)
    if (
      project.completedStep !== PIPELINE_STEPS.PORTRAITS || !style.success ||
      project.geminiBookState !== 'READY' || project.geminiBookFileUri === null ||
      !this.validCharacters(project.characters)
    ) throw new PipelineError(PREREQUISITE_ERROR, 409)

    const generated = generatedChapterSchema.parse(await this.gemini.generateChapter({
      bookFileUri: project.geminiBookFileUri,
      style: style.data,
      characters: project.characters.map(({ name, prompt }) => ({ name, prompt })),
    }))
    const persisted = await this.chapters.replaceForAcquiredRun({
      projectId: input.projectId, userId: input.userId, startedAt: input.startedAt,
      chapter: {
        id: randomUUID(), name: generated.chapter.name, prompt: generated.chapter.prompt,
        characterIdsJson: JSON.stringify(project.characters.map((character) => character.id)), position: 0,
      },
    })
    if (!persisted) throw new PipelineError(PERSISTENCE_ERROR, 500)
  }

  private validCharacters(characters: ChaptersProject['characters']): boolean {
    return characters.length >= 1 && characters.length <= 2 && characters.every((character, position) =>
      character.position === position && character.name.trim().length > 0 &&
      character.prompt.trim().split(/\s+/).filter(Boolean).length >= 50 &&
      character.generationStatus === 'DONE' && character.generationError === null && character.imagePath !== null,
    )
  }

  private isCheckpoint(input: Parameters<PipelineExecutor['execute']>[0], project: ChaptersProject): boolean {
    if (!input.isRetry || input.retryCompletedStep !== PIPELINE_STEPS.PORTRAITS || input.retryRunningStep !== PIPELINE_STEPS.CHAPTERS) return false
    if (!this.validCharacters(project.characters) || project.chapters.length !== 1) return false
    const chapter = project.chapters[0]
    if (!chapter) return false
    if (!persistedChapterSchema.safeParse(chapter).success || chapter.characterIdsJson === null) return false
    try {
      const ids = JSON.parse(chapter.characterIdsJson)
      const currentIds = project.characters.map((character) => character.id)
      return Array.isArray(ids) && ids.length === currentIds.length &&
        ids.every((id, index) => typeof id === 'string' && id === currentIds[index]) &&
        new Set(ids).size === ids.length
    } catch {
      return false
    }
  }
}
