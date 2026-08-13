import { GoogleGenAI } from '@google/genai'

import type { StyleGenerator } from '../../modules/pipeline/style/style-generator.port.js'
import { STYLE_PROMPT } from './prompts/style.prompt.js'
import { parseJsonResponse } from './google-gemini-response.js'

const STYLE_SCHEMA = {
  type: 'object',
  properties: { style: { type: 'string' } },
  required: ['style'],
  additionalProperties: false,
} as const

export class GoogleGeminiStyleAdapter implements StyleGenerator {
  private readonly client: GoogleGenAI

  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string,
  ) {
    this.client = new GoogleGenAI({ apiKey: apiKey ?? '' })
  }

  async generateStyle(input: { bookFileUri: string }): Promise<unknown> {
    if (!this.apiKey?.trim()) {
      throw new Error('Gemini API key is not configured.')
    }

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [{
        role: 'user',
        parts: [
          { text: STYLE_PROMPT },
          { fileData: { fileUri: input.bookFileUri, mimeType: 'text/plain' } },
        ],
      }],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: STYLE_SCHEMA,
      },
    })

    return parseJsonResponse(response, 'STYLE')
  }
}
