import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'

import { env } from '../config/env.js'

const workspaceRoot = fileURLToPath(
  new URL('../../../../', import.meta.url),
)

const databaseUrl = env.DATABASE_URL.startsWith('file:./')
  ? `file:${resolve(
      workspaceRoot,
      env.DATABASE_URL.slice('file:'.length),
    )}`
  : env.DATABASE_URL

export const sqliteClient = createClient({
  url: databaseUrl,
})

export const db = drizzle(sqliteClient)
