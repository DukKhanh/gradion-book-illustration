import { z } from 'zod'

export const generatedStyleSchema = z.object({
  style: z.string().trim().min(20).max(1500),
}).strict()

export const manualStyleSchema = z.string().trim().min(1).max(1500)
