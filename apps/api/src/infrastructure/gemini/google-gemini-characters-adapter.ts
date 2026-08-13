import { GoogleGenAI } from '@google/genai'

import type { CharacterGenerator } from '../../modules/pipeline/characters/character-generator.port.js'
import { CHARACTERS_PROMPT } from './prompts/characters.prompt.js'
import { parseJsonResponse } from './google-gemini-response.js'

const CHARACTERS_SCHEMA = {
  type: 'object',
  properties: {
    characters: {
      type: 'array',
      minItems: 1,
      maxItems: 2,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          prompt: { type: 'string' },
          isAdult: { type: 'boolean', enum: [true] },
        },
        required: ['name', 'prompt', 'isAdult'],
        additionalProperties: false,
      },
    },
  },
  required: ['characters'],
  additionalProperties: false,
} as const

export class GoogleGeminiCharactersAdapter implements CharacterGenerator {
  private readonly client: GoogleGenAI

  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string,
  ) {
    this.client = new GoogleGenAI({ apiKey: apiKey ?? '' })
  }

  async generateCharacters(input: {
    bookFileUri: string
    style: string
  }): Promise<unknown> {
    if (!this.apiKey?.trim()) {
      throw new Error('Gemini API key is not configured.')
    }

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [{
        role: 'user',
        parts: [
          { text: CHARACTERS_PROMPT },
          { text: `Art direction: ${input.style}` },
          { fileData: { fileUri: input.bookFileUri, mimeType: 'text/plain' } },
        ],
      }],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: CHARACTERS_SCHEMA,
      },
    })

    return parseJsonResponse(response, 'CHARACTERS')
  }
}
