import cors from 'cors'
import express from 'express'
import session from 'express-session'
import multer from 'multer'

import { env } from './config/env.js'
import { PipelineRepository } from './modules/pipeline/pipeline.repository.js'
import { createPipelineRouter } from './modules/pipeline/pipeline.routes.js'
import {
  PipelineService,
  unsupportedPipelineExecutor,
} from './modules/pipeline/pipeline.service.js'
import { ProjectController } from './modules/projects/project.controller.js'
import { ProjectRepository } from './modules/projects/project.repository.js'
import { createProjectRouter } from './modules/projects/project.routes.js'
import { ProjectService } from './modules/projects/project.service.js'
import { SessionController } from './modules/session/session.controller.js'
import { createSessionRouter } from './modules/session/session.routes.js'
import { SessionService } from './modules/session/session.service.js'
import { UserRepository } from './modules/session/user.repository.js'
import { HttpError } from './shared/http-error.js'
import { FileStorageService } from './storage/file-storage.service.js'

type AppDependencies = {
  sessionController?: SessionController
  projectController?: ProjectController
  pipelineService?: PipelineService
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
    unsupportedPipelineExecutor,
    { staleAfterMs: env.PIPELINE_STALE_AFTER_MS },
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
  app.use('/api', createPipelineRouter(pipelineService))

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
