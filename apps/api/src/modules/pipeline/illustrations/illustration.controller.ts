import type { NextFunction, Request, Response } from 'express'

import { IllustrationService } from './illustration.service.js'

export class IllustrationController {
  constructor(private readonly service: IllustrationService) {}

  read = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = typeof req.params.projectId === 'string' ? req.params.projectId : ''
      const chapterId = typeof req.params.chapterId === 'string' ? req.params.chapterId : ''
      res.type('image/png').send(await this.service.read(req.session.userId!, projectId, chapterId))
    } catch (error) { next(error) }
  }
}
