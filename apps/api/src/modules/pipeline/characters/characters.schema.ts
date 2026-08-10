import { z } from 'zod'

const nameSchema = z.string().trim().min(1).max(120)
const promptSchema = z.string().trim().max(5000).refine(
  (value) => value.split(/\s+/).filter(Boolean).length >= 50,
  'Character prompts must contain at least 50 words.',
)

export const generatedCharacterSchema = z.object({
  name: nameSchema,
  prompt: promptSchema,
  isAdult: z.literal(true),
}).strict()

export const generatedCharactersSchema = z.object({
  characters: z.array(generatedCharacterSchema).min(1).max(2),
}).strict().superRefine((value, context) => {
  const names = new Set<string>()
  for (const [index, character] of value.characters.entries()) {
    const normalized = character.name.toLocaleLowerCase()
    if (names.has(normalized)) {
      context.addIssue({
        code: 'custom',
        path: ['characters', index, 'name'],
        message: 'Character names must be unique.',
      })
    }
    names.add(normalized)
  }
})

export const persistedCharacterSchema = z.object({
  name: nameSchema,
  prompt: promptSchema,
  position: z.number().int().min(0).max(1),
  generationStatus: z.literal('PENDING'),
  generationError: z.null(),
  imagePath: z.null(),
}).strict()
