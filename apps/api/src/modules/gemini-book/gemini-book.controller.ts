import type {
  NextFunction,
  Request,
  Response,
} from 'express'

import type { GeminiBookService } from './gemini-book.service.js'

function projectId(req: Request): string {
  return typeof req.params.projectId === 'string' ? req.params.projectId : ''
}

export class GeminiBookController {
  constructor(private readonly service: GeminiBookService) {}

  initialize = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.initialize(req.session.userId!, projectId(req))
      res.status(200).json({ status: 'ready' })
    } catch (error) {
      next(error)
    }
  }

  recoverStale = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.recoverStale(req.session.userId!, projectId(req))
      res.status(200).json({ status: 'recovered' })
    } catch (error) {
      next(error)
    }
  }
}
