import cors from 'cors'
import express from 'express'

import { env } from './config/env.js'
import { PipelineError } from './modules/pipeline/pipeline.errors.js'
import { pipelineRouter } from './modules/pipeline/pipeline.routes.js'

export const app = express()

app.use(
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true,
  }),
)

app.use(express.json())

app.use('/api', pipelineRouter)

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
    if (error instanceof PipelineError) {
      res.status(error.statusCode).json({
        error: error.message,
      })
      return
    }

    res.status(500).json({ error: 'Internal server error.' })
  },
)
