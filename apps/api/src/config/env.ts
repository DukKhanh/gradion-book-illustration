import { fileURLToPath } from 'node:url'

import dotenv from 'dotenv'
import { z } from 'zod'

const rootEnvPath = fileURLToPath(
  new URL('../../../../.env', import.meta.url),
)

dotenv.config({
  path: rootEnvPath,
})

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce
    .number()
    .positive()
    .default(3000),

  WEB_ORIGIN: z
    .string()
    .url()
    .default('http://localhost:5173'),

  DATABASE_URL: z
    .string()
    .default('file:./data/app.db'),

  SESSION_SECRET: z
    .string()
    .min(1),

  GEMINI_API_KEY: z
    .string()
    .optional(),

  GEMINI_TEXT_MODEL: z
    .string()
    .default('gemini-2.5-flash'),

  GEMINI_IMAGE_MODEL: z
    .string()
    .default('gemini-2.5-flash-image'),

  PIPELINE_STALE_AFTER_MS: z.coerce
    .number()
    .positive()
    .default(180000),
})

export const env = envSchema.parse(process.env)