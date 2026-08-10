import { Router } from 'express'

import { SessionController } from './session.controller.js'

export function createSessionRouter(
  controller: SessionController,
): Router {
  const router = Router()
  router.post('/session', controller.create)
  router.get('/session', controller.current)
  router.delete('/session', controller.destroy)
  return router
}
