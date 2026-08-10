import { Router } from 'express'

import { requireSession } from '../../session/session.middleware.js'
import { PortraitController } from './portrait.controller.js'

export function createPortraitRouter(controller: PortraitController): Router {
  const router = Router()
  router.get('/projects/:projectId/characters/:characterId/portrait', requireSession, controller.read)
  return router
}
