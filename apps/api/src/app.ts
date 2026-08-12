import cors from 'cors'
import express from 'express'
import session from 'express-session'
import multer from 'multer'

import { env } from './config/env.js'
import { createApplicationModules, type ApplicationModules } from './composition/create-application-modules.js'
import { createGeminiBookRouter } from './modules/gemini-book/gemini-book.routes.js'
import { createPipelineRouter } from './modules/pipeline/pipeline.routes.js'
import { createPortraitRouter } from './modules/pipeline/portraits/portrait.routes.js'
import { createIllustrationRouter } from './modules/pipeline/illustrations/illustration.routes.js'
import { createProjectRouter } from './modules/projects/project.routes.js'
import { createSessionRouter } from './modules/session/session.routes.js'
import { HttpError } from './shared/http-error.js'

type AppDependencies = Partial<ApplicationModules>

export function createApp(dependencies: AppDependencies = {}) {
  const app = express()
  const modules = { ...createApplicationModules(), ...dependencies }

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

  app.use('/api', createSessionRouter(modules.sessionController))
  app.use('/api', createProjectRouter(modules.projectController))
  app.use('/api', createGeminiBookRouter(modules.geminiBookController))
  app.use('/api', createPipelineRouter(modules.pipelineService))
  app.use('/api', createPortraitRouter(modules.portraitController))
  app.use('/api', createIllustrationRouter(modules.illustrationController))

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
