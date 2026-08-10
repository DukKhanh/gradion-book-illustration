import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './apps/api/src/db/schema.ts',
  out: './apps/api/drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/app.db',
  },
})
