import { GoogleGenAI } from '@google/genai'

import type { StyleGenerator } from '../../modules/pipeline/style/style-generator.port.js'
import { STYLE_PROMPT } from './prompts/style.prompt.js'

export class GoogleGeminiStyleAdapter implements StyleGenerator {
  private readonly client: GoogleGenAI
  private readonly apiKey: string | undefined

  constructor(
    apiKey: string | undefined,
    private readonly model: string,
  ) {
    this.apiKey = apiKey
    this.client = new GoogleGenAI({ apiKey: apiKey ?? '' })
  }

  async generateStyle(input: { bookFileUri: string }): Promise<unknown> {
    if (!this.apiKey?.trim()) {
      throw new Error('Gemini API key is not configured.')
    }

    const interaction = await this.client.interactions.create({
      model: this.model,
      input: [
        { type: 'text', text: STYLE_PROMPT },
        { type: 'document', uri: input.bookFileUri, mime_type: 'text/plain' },
      ],
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: {
          type: 'object',
          properties: { style: { type: 'string' } },
          required: ['style'],
          additionalProperties: false,
        },
      },
    })

    if (!interaction.output_text) {
      throw new Error('Gemini did not return STYLE output.')
    }
    return JSON.parse(interaction.output_text)
  }
}
