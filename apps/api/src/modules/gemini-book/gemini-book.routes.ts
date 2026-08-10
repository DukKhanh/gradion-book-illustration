import { Router } from 'express'

import { requireSession } from '../session/session.middleware.js'
import { GeminiBookController } from './gemini-book.controller.js'

export function createGeminiBookRouter(
  controller: GeminiBookController,
): Router {
  const router = Router()
  router.post(
    '/projects/:projectId/gemini-book/recover',
    requireSession,
    controller.recoverStale,
  )
  router.post(
    '/projects/:projectId/gemini-book',
    requireSession,
    controller.initialize,
  )
  return router
}
