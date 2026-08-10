import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'

import { env } from '../config/env.js'

export const sqliteClient = createClient({
  url: env.DATABASE_URL,
})

export const db = drizzle(sqliteClient)