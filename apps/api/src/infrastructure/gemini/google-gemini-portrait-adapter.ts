import { GoogleGenAI } from '@google/genai'

import type { PortraitGenerator } from '../../modules/pipeline/portraits/portrait-generator.port.js'
import { portraitPrompt } from './prompts/portrait.prompt.js'

export class GoogleGeminiPortraitAdapter implements PortraitGenerator {
  private readonly client: GoogleGenAI

  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string,
  ) {
    this.client = new GoogleGenAI({ apiKey: apiKey ?? '' })
  }

  async generatePortrait(input: {
    characterName: string
    characterPrompt: string
    style: string
  }): Promise<{ bytes: Uint8Array, mimeType: string }> {
    if (!this.apiKey?.trim()) throw new Error('Gemini API key is not configured.')
    const interaction = await this.client.interactions.create({
      model: this.model,
      input: portraitPrompt(input),
      response_format: {
        type: 'image',
        mime_type: 'image/jpeg',
        aspect_ratio: '9:16',
      },
    })
    const image = interaction.output_image
    if (!image?.data || image.mime_type !== 'image/jpeg') {
      throw new Error('Gemini did not return a JPEG portrait.')
    }
    return { bytes: Buffer.from(image.data, 'base64'), mimeType: image.mime_type }
  }
}
