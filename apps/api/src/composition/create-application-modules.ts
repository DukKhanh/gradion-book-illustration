import { env } from '../config/env.js'
import { GoogleGeminiBookAdapter } from '../infrastructure/gemini/google-gemini-book-adapter.js'
import { GoogleGeminiChapterAdapter } from '../infrastructure/gemini/google-gemini-chapter-adapter.js'
import { GoogleGeminiCharactersAdapter } from '../infrastructure/gemini/google-gemini-characters-adapter.js'
import { GoogleGeminiIllustrationAdapter } from '../infrastructure/gemini/google-gemini-illustration-adapter.js'
import { GoogleGeminiPortraitAdapter } from '../infrastructure/gemini/google-gemini-portrait-adapter.js'
import { GoogleGeminiStyleAdapter } from '../infrastructure/gemini/google-gemini-style-adapter.js'
import { FileStorageService } from '../infrastructure/storage/file-storage.service.js'
import { GeminiBookController } from '../modules/gemini-book/gemini-book.controller.js'
import { GeminiBookRepository } from '../modules/gemini-book/gemini-book.repository.js'
import { GeminiBookService } from '../modules/gemini-book/gemini-book.service.js'
import { ChaptersRepository } from '../modules/pipeline/chapters/chapters.repository.js'
import { ChaptersStepExecutor } from '../modules/pipeline/chapters/chapters-step.executor.js'
import { CharactersRepository } from '../modules/pipeline/characters/characters.repository.js'
import { CharactersStepExecutor } from '../modules/pipeline/characters/characters-step.executor.js'
import { IllustrationController } from '../modules/pipeline/illustrations/illustration.controller.js'
import { IllustrationService } from '../modules/pipeline/illustrations/illustration.service.js'
import { IllustrationsRepository } from '../modules/pipeline/illustrations/illustrations.repository.js'
import { IllustrationsStepExecutor } from '../modules/pipeline/illustrations/illustrations-step.executor.js'
import { PipelineRepository } from '../modules/pipeline/pipeline.repository.js'
import { PipelineService } from '../modules/pipeline/pipeline.service.js'
import { PipelineStepExecutor } from '../modules/pipeline/pipeline-step.executor.js'
import { PortraitController } from '../modules/pipeline/portraits/portrait.controller.js'
import { PortraitService } from '../modules/pipeline/portraits/portrait.service.js'
import { PortraitsRepository } from '../modules/pipeline/portraits/portraits.repository.js'
import { PortraitsStepExecutor } from '../modules/pipeline/portraits/portraits-step.executor.js'
import { StyleRepository } from '../modules/pipeline/style/style.repository.js'
import { StyleStepExecutor } from '../modules/pipeline/style/style-step.executor.js'
import { ProjectController } from '../modules/projects/project.controller.js'
import { ProjectRepository } from '../modules/projects/project.repository.js'
import { ProjectService } from '../modules/projects/project.service.js'
import { SessionController } from '../modules/session/session.controller.js'
import { SessionService } from '../modules/session/session.service.js'
import { UserRepository } from '../modules/session/user.repository.js'

export type ApplicationModules = {
  sessionController: SessionController
  projectController: ProjectController
  pipelineService: PipelineService
  geminiBookController: GeminiBookController
  portraitController: PortraitController
  illustrationController: IllustrationController
}

export function createApplicationModules(): ApplicationModules {
  const storage = new FileStorageService()

  return {
    sessionController: new SessionController(new SessionService(new UserRepository())),
    projectController: new ProjectController(new ProjectService(new ProjectRepository(), storage)),
    pipelineService: new PipelineService(
      new PipelineRepository(),
      new PipelineStepExecutor(
        new StyleStepExecutor(new StyleRepository(), new GoogleGeminiStyleAdapter(env.GEMINI_API_KEY, env.GEMINI_TEXT_MODEL)),
        new CharactersStepExecutor(new CharactersRepository(), new GoogleGeminiCharactersAdapter(env.GEMINI_API_KEY, env.GEMINI_TEXT_MODEL)),
        new PortraitsStepExecutor(new PortraitsRepository(), new GoogleGeminiPortraitAdapter(env.GEMINI_API_KEY, env.GEMINI_IMAGE_MODEL), storage),
        new ChaptersStepExecutor(new ChaptersRepository(), new GoogleGeminiChapterAdapter(env.GEMINI_API_KEY, env.GEMINI_TEXT_MODEL)),
        new IllustrationsStepExecutor(new IllustrationsRepository(), new GoogleGeminiIllustrationAdapter(env.GEMINI_API_KEY, env.GEMINI_IMAGE_MODEL), storage),
      ),
      { staleAfterMs: env.PIPELINE_STALE_AFTER_MS },
    ),
    portraitController: new PortraitController(new PortraitService(new PortraitsRepository(), storage)),
    illustrationController: new IllustrationController(new IllustrationService(new IllustrationsRepository(), storage)),
    geminiBookController: new GeminiBookController(new GeminiBookService(
      new GeminiBookRepository(),
      storage,
      new GoogleGeminiBookAdapter(env.GEMINI_API_KEY),
      { apiKey: env.GEMINI_API_KEY, staleAfterMs: env.GEMINI_BOOK_STALE_AFTER_MS },
    )),
  }
}
