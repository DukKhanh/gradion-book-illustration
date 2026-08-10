import type {
  NextFunction,
  Request,
  Response,
} from 'express'

import {
  PIPELINE_STEPS,
} from './pipeline.constants.js'
import { PipelineError } from './pipeline.errors.js'
import type { PipelineService } from './pipeline.service.js'
import type { PipelineStep } from './pipeline.types.js'

function singleParam(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : ''
}

function parseStep(value: string | string[] | undefined): PipelineStep {
  if (!Object.values(PIPELINE_STEPS).includes(value as PipelineStep)) {
    throw new PipelineError('Unknown pipeline step.', 400)
  }
  return value as PipelineStep
}

export class PipelineController {
  constructor(private readonly service: PipelineService) {}

  run = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const step = parseStep(req.params.step)
      const hasStyle = Object.prototype.hasOwnProperty.call(
        req.body ?? {},
        'style',
      )
      if (hasStyle && step !== PIPELINE_STEPS.STYLE) {
        throw new PipelineError(
          'A style may only be supplied for the STYLE step.',
          400,
        )
      }
      await this.service.run(
        req.session.userId!,
        singleParam(req.params.projectId),
        step,
        { manualStyle: hasStyle ? req.body.style : undefined },
      )
      res.status(200).json({ status: 'completed' })
    } catch (error) {
      next(error)
    }
  }

  recoverStale = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.service.recoverStale(
        req.session.userId!,
        singleParam(req.params.projectId),
      )
      res.status(200).json({ status: 'recovered' })
    } catch (error) {
      next(error)
    }
  }
}
