import { z } from 'zod'

export const chapterNameSchema = z.string().trim().min(1).max(200)
export const chapterPromptSchema = z.string().trim().min(1).max(5000)

export const generatedChapterSchema = z.object({
  chapter: z.object({
    name: chapterNameSchema,
    prompt: chapterPromptSchema,
  }).strict(),
}).strict()

export const persistedChapterSchema = z.object({
  name: chapterNameSchema,
  prompt: chapterPromptSchema,
  characterIdsJson: z.string(),
  position: z.literal(0),
  generationStatus: z.literal('PENDING'),
  generationError: z.null(),
  imagePath: z.null(),
}).strict()
