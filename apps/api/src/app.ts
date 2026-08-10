import cors from 'cors'
import express from 'express'

import { env } from './config/env.js'

export const app = express()

app.use(
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true,
  }),
)

app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'api',
  })
})