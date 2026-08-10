import { Router } from 'express'
import multer from 'multer'

import { requireSession } from '../session/session.middleware.js'
import { ProjectController } from './project.controller.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1_000_000, files: 1 },
})

export function createProjectRouter(
  controller: ProjectController,
): Router {
  const router = Router()
  router.get('/projects', requireSession, controller.list)
  router.post(
    '/projects',
    requireSession,
    upload.single('bookFile'),
    controller.create,
  )
  router.get('/projects/:projectId', requireSession, controller.detail)
  return router
}
