import type {
  NextFunction,
  Request,
  Response,
} from 'express'

export function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.session.userId) {
    res.status(401).json({ error: 'Authentication required.' })
    return
  }
  next()
}
