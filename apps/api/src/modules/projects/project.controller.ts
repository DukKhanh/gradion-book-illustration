import type {
  NextFunction,
  Request,
  Response,
} from 'express'

import type { ProjectService } from './project.service.js'

export class ProjectController {
  constructor(private readonly service: ProjectService) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await this.service.create({
        userId: req.session.userId!,
        title: req.body.title,
        bookText: req.body.bookText,
        upload: req.file,
      })
      res.status(201).json({ project })
    } catch (error) {
      next(error)
    }
  }

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json({
        projects: await this.service.list(req.session.userId!),
      })
    } catch (error) {
      next(error)
    }
  }

  detail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = typeof req.params.projectId === 'string'
        ? req.params.projectId
        : ''
      res.status(200).json({
        project: await this.service.detail(req.session.userId!, projectId),
      })
    } catch (error) {
      next(error)
    }
  }
}
