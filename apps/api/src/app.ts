import cors from 'cors'
import express from 'express'
import session from 'express-session'
import multer from 'multer'

import { env } from './config/env.js'
import { GeminiBookController } from './modules/gemini-book/gemini-book.controller.js'
import { GeminiBookRepository } from './modules/gemini-book/gemini-book.repository.js'
import { createGeminiBookRouter } from './modules/gemini-book/gemini-book.routes.js'
import { GeminiBookService } from './modules/gemini-book/gemini-book.service.js'
import { PipelineRepository } from './modules/pipeline/pipeline.repository.js'
import { createPipelineRouter } from './modules/pipeline/pipeline.routes.js'
import { PipelineStepExecutor } from './modules/pipeline/pipeline-step.executor.js'
import { PortraitController } from './modules/pipeline/portraits/portrait.controller.js'
import { PortraitService } from './modules/pipeline/portraits/portrait.service.js'
import { PortraitsRepository } from './modules/pipeline/portraits/portraits.repository.js'
import { createPortraitRouter } from './modules/pipeline/portraits/portrait.routes.js'
import { PortraitsStepExecutor } from './modules/pipeline/portraits/portraits-step.executor.js'
import { ChaptersRepository } from './modules/pipeline/chapters/chapters.repository.js'
import { ChaptersStepExecutor } from './modules/pipeline/chapters/chapters-step.executor.js'
import { IllustrationController } from './modules/pipeline/illustrations/illustration.controller.js'
import { IllustrationService } from './modules/pipeline/illustrations/illustration.service.js'
import { IllustrationsRepository } from './modules/pipeline/illustrations/illustrations.repository.js'
import { createIllustrationRouter } from './modules/pipeline/illustrations/illustration.routes.js'
import { IllustrationsStepExecutor } from './modules/pipeline/illustrations/illustrations-step.executor.js'
import {
  PipelineService,
} from './modules/pipeline/pipeline.service.js'
import { StyleRepository } from './modules/pipeline/style/style.repository.js'
import { StyleStepExecutor } from './modules/pipeline/style/style-step.executor.js'
import { CharactersRepository } from './modules/pipeline/characters/characters.repository.js'
import { CharactersStepExecutor } from './modules/pipeline/characters/characters-step.executor.js'
import { ProjectController } from './modules/projects/project.controller.js'
import { ProjectRepository } from './modules/projects/project.repository.js'
import { createProjectRouter } from './modules/projects/project.routes.js'
import { ProjectService } from './modules/projects/project.service.js'
import { SessionController } from './modules/session/session.controller.js'
import { createSessionRouter } from './modules/session/session.routes.js'
import { SessionService } from './modules/session/session.service.js'
import { UserRepository } from './modules/session/user.repository.js'
import { HttpError } from './shared/http-error.js'
import { GoogleGeminiBookAdapter } from './services/gemini/google-gemini-book-adapter.js'
import { GoogleGeminiStyleAdapter } from './services/gemini/google-gemini-style-adapter.js'
import { GoogleGeminiCharactersAdapter } from './services/gemini/google-gemini-characters-adapter.js'
import { GoogleGeminiPortraitAdapter } from './services/gemini/google-gemini-portrait-adapter.js'
import { GoogleGeminiChapterAdapter } from './services/gemini/google-gemini-chapter-adapter.js'
import { GoogleGeminiIllustrationAdapter } from './services/gemini/google-gemini-illustration-adapter.js'
import { FileStorageService } from './storage/file-storage.service.js'

type AppDependencies = {
  sessionController?: SessionController
  projectController?: ProjectController
  pipelineService?: PipelineService
  geminiBookController?: GeminiBookController
  portraitController?: PortraitController
  illustrationController?: IllustrationController
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express()
  const sessionController = dependencies.sessionController ?? new SessionController(
    new SessionService(new UserRepository()),
  )
  const projectController = dependencies.projectController ?? new ProjectController(
    new ProjectService(
      new ProjectRepository(),
      new FileStorageService(),
    ),
  )
  const pipelineService = dependencies.pipelineService ?? new PipelineService(
    new PipelineRepository(),
    new PipelineStepExecutor(
      new StyleStepExecutor(
        new StyleRepository(),
        new GoogleGeminiStyleAdapter(
          env.GEMINI_API_KEY,
          env.GEMINI_TEXT_MODEL,
        ),
      ),
      new CharactersStepExecutor(
        new CharactersRepository(),
        new GoogleGeminiCharactersAdapter(
          env.GEMINI_API_KEY,
          env.GEMINI_TEXT_MODEL,
        ),
      ),
      new PortraitsStepExecutor(
        new PortraitsRepository(),
        new GoogleGeminiPortraitAdapter(env.GEMINI_API_KEY, env.GEMINI_IMAGE_MODEL),
        new FileStorageService(),
      ),
      new ChaptersStepExecutor(
        new ChaptersRepository(),
        new GoogleGeminiChapterAdapter(
          env.GEMINI_API_KEY,
          env.GEMINI_TEXT_MODEL,
        ),
      ),
      new IllustrationsStepExecutor(
        new IllustrationsRepository(),
        new GoogleGeminiIllustrationAdapter(env.GEMINI_API_KEY, env.GEMINI_IMAGE_MODEL),
        new FileStorageService(),
      ),
    ),
    { staleAfterMs: env.PIPELINE_STALE_AFTER_MS },
  )
  const portraitController = dependencies.portraitController ?? new PortraitController(
    new PortraitService(new PortraitsRepository(), new FileStorageService()),
  )
  const illustrationController = dependencies.illustrationController ?? new IllustrationController(
    new IllustrationService(new IllustrationsRepository(), new FileStorageService()),
  )
  const geminiBookController = dependencies.geminiBookController ?? new GeminiBookController(
    new GeminiBookService(
      new GeminiBookRepository(),
      new FileStorageService(),
      new GoogleGeminiBookAdapter(env.GEMINI_API_KEY),
      {
        apiKey: env.GEMINI_API_KEY,
        staleAfterMs: env.GEMINI_BOOK_STALE_AFTER_MS,
      },
    ),
  )

  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
    }),
  )
  app.use(express.json())
  app.use(session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
    },
  }))

  app.use('/api', createSessionRouter(sessionController))
  app.use('/api', createProjectRouter(projectController))
  app.use('/api', createGeminiBookRouter(geminiBookController))
  app.use('/api', createPipelineRouter(pipelineService))
  app.use('/api', createPortraitRouter(portraitController))
  app.use('/api', createIllustrationRouter(illustrationController))

  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'api',
    })
  })

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message })
        return
      }
      if (error instanceof multer.MulterError) {
        res.status(400).json({ error: 'Invalid book upload.' })
        return
      }

      res.status(500).json({ error: 'Internal server error.' })
    },
  )

  return app
}

export const app = createApp()
