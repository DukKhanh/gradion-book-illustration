import { Router } from 'express'

import { PipelineController } from './pipeline.controller.js'
import { requireSession } from '../session/session.middleware.js'
import type { PipelineService } from './pipeline.service.js'

export function createPipelineRouter(service: PipelineService): Router {
  const controller = new PipelineController(service)
  const router = Router()
  router.post(
  '/projects/:projectId/pipeline/recover',
  requireSession,
  controller.recoverStale,
  )
  router.post(
  '/projects/:projectId/pipeline/:step',
  requireSession,
  controller.run,
  )
  return router
}
