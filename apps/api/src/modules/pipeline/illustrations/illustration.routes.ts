import { Router } from 'express'

import { requireSession } from '../../session/session.middleware.js'
import { IllustrationController } from './illustration.controller.js'

export function createIllustrationRouter(controller: IllustrationController): Router {
  const router = Router()
  router.get('/projects/:projectId/chapters/:chapterId/illustration', requireSession, controller.read)
  return router
}
