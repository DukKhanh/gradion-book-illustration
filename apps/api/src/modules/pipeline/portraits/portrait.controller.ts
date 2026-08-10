import type { NextFunction, Request, Response } from 'express'

import { PortraitService } from './portrait.service.js'

export class PortraitController {
  constructor(private readonly service: PortraitService) {}

  read = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = typeof req.params.projectId === 'string' ? req.params.projectId : ''
      const characterId = typeof req.params.characterId === 'string' ? req.params.characterId : ''
      const image = await this.service.read(req.session.userId!, projectId, characterId)
      res.type('image/png').send(image)
    } catch (error) { next(error) }
  }
}
