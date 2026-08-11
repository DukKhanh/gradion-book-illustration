import type { GeminiIllustrationAdapter } from '../../../services/gemini/gemini-illustration-adapter.js'
import { chapterNameSchema, chapterPromptSchema } from '../chapters/chapters.schema.js'
import { PIPELINE_STEPS } from '../pipeline.constants.js'
import { PipelineError } from '../pipeline.errors.js'
import type { PipelineExecutor } from '../pipeline.service.js'
import { manualStyleSchema } from '../style/style.schema.js'
import { IllustrationsRepository, type IllustrationProject } from './illustrations.repository.js'

const PREREQUISITE_ERROR = 'CHAPTERS, STYLE, and a valid chapter association are required before ILLUSTRATIONS can run.'
const ILLUSTRATION_ERROR = 'Illustration generation failed.'

export interface IllustrationStorage {
  writeIllustration(input: { userId: string, projectId: string, chapterId: string, stepStartedAt: Date, bytes: Uint8Array }): Promise<string>
  illustrationExists(path: string): Promise<boolean>
  deleteIllustration(path: string): Promise<void>
}

export class IllustrationsStepExecutor implements PipelineExecutor {
  constructor(private readonly illustrations: IllustrationsRepository, private readonly gemini: GeminiIllustrationAdapter, private readonly storage: IllustrationStorage) {}

  async execute(input: Parameters<PipelineExecutor['execute']>[0]): Promise<void> {
    if (input.step !== PIPELINE_STEPS.ILLUSTRATIONS) throw new Error('This pipeline step is not implemented.')
    const project = await this.illustrations.findForExecution(input.projectId, input.userId)
    if (!project) throw new PipelineError('Project not found.', 404)
    const style = manualStyleSchema.safeParse(project.style)
    const chapter = project.chapters[0]
    if (project.completedStep !== PIPELINE_STEPS.CHAPTERS || !style.success || !chapter || project.chapters.length !== 1 || !this.validInput(project, chapter)) throw new PipelineError(PREREQUISITE_ERROR, 409)
    if (await this.isDurable(chapter)) return

    const begun = await this.illustrations.beginIllustration({ ...input, chapterId: chapter.id })
    if (!begun) throw new PipelineError('ILLUSTRATIONS execution is no longer current.', 500)
    let imagePath: string | undefined
    try {
      const image = await this.gemini.generateIllustration({ chapterName: chapter.name, chapterPrompt: chapter.prompt, style: style.data })
      if (image.mimeType !== 'image/jpeg' || image.bytes.length === 0) throw new Error('Invalid illustration image.')
      imagePath = await this.storage.writeIllustration({ userId: input.userId, projectId: input.projectId, chapterId: chapter.id, stepStartedAt: input.startedAt, bytes: image.bytes })
      const completed = await this.illustrations.completeIllustration({ ...input, chapterId: chapter.id, imagePath })
      if (!completed) {
        try { await this.storage.deleteIllustration(imagePath) } catch { /* inaccessible orphan is acceptable */ }
        throw new PipelineError('Illustration checkpoint could not be persisted.', 500)
      }
    } catch (error) {
      if (error instanceof PipelineError) throw error
      if (imagePath) {
        try { await this.storage.deleteIllustration(imagePath) } catch { /* inaccessible orphan is acceptable */ }
      }
      const failed = await this.illustrations.failIllustration({ ...input, chapterId: chapter.id, error: ILLUSTRATION_ERROR })
      if (!failed) throw new PipelineError('Illustration failure could not be persisted.', 500)
      throw new Error(ILLUSTRATION_ERROR)
    }
  }

  private validInput(project: IllustrationProject, chapter: IllustrationProject['chapters'][number]): boolean {
    if (chapter.position !== 0 || !chapterNameSchema.safeParse(chapter.name).success || !chapterPromptSchema.safeParse(chapter.prompt).success) return false
    const characters = project.characters
    if (characters.length < 1 || characters.length > 2 || !characters.every((character, position) => character.position === position && character.name.trim().length > 0 && character.prompt.trim().split(/\s+/).filter(Boolean).length >= 50)) return false
    try {
      const ids = JSON.parse(chapter.characterIdsJson ?? '')
      const current = characters.map((character) => character.id)
      return Array.isArray(ids) && ids.length === current.length && new Set(ids).size === ids.length && ids.every((id, index) => typeof id === 'string' && id === current[index])
    } catch { return false }
  }

  private async isDurable(chapter: IllustrationProject['chapters'][number]): Promise<boolean> {
    return chapter.generationStatus === 'DONE' && chapter.imagePath !== null && await this.storage.illustrationExists(chapter.imagePath)
  }
}
