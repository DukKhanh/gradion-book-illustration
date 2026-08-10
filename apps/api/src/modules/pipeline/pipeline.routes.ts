import { Router } from 'express'

import { env } from '../../config/env.js'
import { PipelineController } from './pipeline.controller.js'
import { PipelineRepository } from './pipeline.repository.js'
import {
  PipelineService,
  unsupportedPipelineExecutor,
} from './pipeline.service.js'

const service = new PipelineService(
  new PipelineRepository(),
  unsupportedPipelineExecutor,
  { staleAfterMs: env.PIPELINE_STALE_AFTER_MS },
)
const controller = new PipelineController(service)

export const pipelineRouter = Router()

pipelineRouter.post(
  '/projects/:projectId/pipeline/recover',
  controller.recoverStale,
)
pipelineRouter.post(
  '/projects/:projectId/pipeline/:step',
  controller.run,
)
