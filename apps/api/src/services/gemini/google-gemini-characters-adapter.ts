import { GoogleGenAI } from '@google/genai'

import type { GeminiCharactersAdapter } from './gemini-characters-adapter.js'
import { CHARACTERS_PROMPT } from './prompts/characters.prompt.js'

export class GoogleGeminiCharactersAdapter implements GeminiCharactersAdapter {
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
    const interaction = await this.client.interactions.create({
      model: this.model,
      input: [
        { type: 'text', text: CHARACTERS_PROMPT },
        { type: 'text', text: `Art direction: ${input.style}` },
        { type: 'document', uri: input.bookFileUri, mime_type: 'text/plain' },
      ],
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: {
          type: 'object',
          properties: {
            characters: {
              type: 'array', minItems: 1, maxItems: 2,
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
        },
      },
    })
    if (!interaction.output_text) {
      throw new Error('Gemini did not return CHARACTERS output.')
    }
    return JSON.parse(interaction.output_text)
  }
}
