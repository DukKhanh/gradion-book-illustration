import { GoogleGenAI } from '@google/genai'

import type { GeminiIllustrationAdapter } from './gemini-illustration-adapter.js'
import { illustrationPrompt } from './prompts/illustration.prompt.js'

export class GoogleGeminiIllustrationAdapter implements GeminiIllustrationAdapter {
  private readonly client: GoogleGenAI

  constructor(private readonly apiKey: string | undefined, private readonly model: string) {
    this.client = new GoogleGenAI({ apiKey: apiKey ?? '' })
  }

  async generateIllustration(input: { chapterName: string, chapterPrompt: string, style: string }): Promise<{ bytes: Uint8Array, mimeType: string }> {
    if (!this.apiKey?.trim()) throw new Error('Gemini API key is not configured.')
    const interaction = await this.client.interactions.create({
      model: this.model,
      input: illustrationPrompt(input),
      response_format: { type: 'image', mime_type: 'image/png', aspect_ratio: '3:2' },
    })
    const image = interaction.output_image
    if (!image?.data || image.mime_type !== 'image/png') throw new Error('Gemini did not return a PNG illustration.')
    const bytes = Buffer.from(image.data, 'base64')
    if (bytes.length === 0) throw new Error('Gemini returned an empty illustration.')
    return { bytes, mimeType: image.mime_type }
  }
}
