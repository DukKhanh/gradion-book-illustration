import { GoogleGenAI } from '@google/genai'

import type { ChapterGenerator } from '../../modules/pipeline/chapters/chapter-generator.port.js'
import { CHAPTER_PROMPT } from './prompts/chapter.prompt.js'

export class GoogleGeminiChapterAdapter implements ChapterGenerator {
  private readonly client: GoogleGenAI

  constructor(private readonly apiKey: string | undefined, private readonly model: string) {
    this.client = new GoogleGenAI({ apiKey: apiKey ?? '' })
  }

  async generateChapter(input: { bookFileUri: string, style: string, characters: Array<{ name: string, prompt: string }> }): Promise<unknown> {
    if (!this.apiKey?.trim()) throw new Error('Gemini API key is not configured.')
    const interaction = await this.client.interactions.create({
      model: this.model,
      input: [
        { type: 'text', text: CHAPTER_PROMPT },
        { type: 'text', text: `Art direction: ${input.style}` },
        { type: 'text', text: `Established characters: ${JSON.stringify(input.characters)}` },
        { type: 'document', uri: input.bookFileUri, mime_type: 'text/plain' },
      ],
      response_format: {
        type: 'text', mime_type: 'application/json',
        schema: {
          type: 'object', properties: {
            chapter: { type: 'object', properties: { name: { type: 'string' }, prompt: { type: 'string' } }, required: ['name', 'prompt'], additionalProperties: false },
          }, required: ['chapter'], additionalProperties: false,
        },
      },
    })
    if (!interaction.output_text) throw new Error('Gemini did not return CHAPTERS output.')
    return JSON.parse(interaction.output_text)
  }
}
