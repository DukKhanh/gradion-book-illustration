import type {
  NextFunction,
  Request,
  Response,
} from 'express'

import { HttpError } from '../../shared/http-error.js'
import type { SessionService } from './session.service.js'

export class SessionController {
  constructor(private readonly service: SessionService) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.service.identify(req.body)
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((error) => error ? reject(error) : resolve())
      })
      req.session.userId = user.id
      res.status(200).json({ user })
    } catch (error) {
      next(error)
    }
  }

  current = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.session.userId
      if (!userId) {
        throw new HttpError('Authentication required.', 401)
      }
      res.status(200).json({ user: await this.service.getUser(userId) })
    } catch (error) {
      next(error)
    }
  }

  destroy = (req: Request, res: Response, next: NextFunction): void => {
    req.session.destroy((error) => {
      if (error) {
        next(error)
        return
      }
      res.clearCookie('connect.sid')
      res.status(204).end()
    })
  }
}
