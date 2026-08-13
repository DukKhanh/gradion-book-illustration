import { GoogleGenAI } from '@google/genai'

import type { ChapterGenerator } from '../../modules/pipeline/chapters/chapter-generator.port.js'
import { CHAPTER_PROMPT } from './prompts/chapter.prompt.js'
import { parseJsonResponse } from './google-gemini-response.js'

const CHAPTER_SCHEMA = {
  type: 'object',
  properties: {
    chapter: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        prompt: { type: 'string' },
      },
      required: ['name', 'prompt'],
      additionalProperties: false,
    },
  },
  required: ['chapter'],
  additionalProperties: false,
} as const

export class GoogleGeminiChapterAdapter implements ChapterGenerator {
  private readonly client: GoogleGenAI

  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string,
  ) {
    this.client = new GoogleGenAI({ apiKey: apiKey ?? '' })
  }

  async generateChapter(input: {
    bookFileUri: string
    style: string
    characters: Array<{ name: string, prompt: string }>
  }): Promise<unknown> {
    if (!this.apiKey?.trim()) {
      throw new Error('Gemini API key is not configured.')
    }

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [{
        role: 'user',
        parts: [
          { text: CHAPTER_PROMPT },
          { text: `Art direction: ${input.style}` },
          { text: `Established characters: ${JSON.stringify(input.characters)}` },
          { fileData: { fileUri: input.bookFileUri, mimeType: 'text/plain' } },
        ],
      }],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: CHAPTER_SCHEMA,
      },
    })

    return parseJsonResponse(response, 'CHAPTERS')
  }
}
