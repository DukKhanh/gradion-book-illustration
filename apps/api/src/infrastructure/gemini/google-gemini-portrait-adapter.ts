import { GoogleGenAI } from '@google/genai'

import type { PortraitGenerator } from '../../modules/pipeline/portraits/portrait-generator.port.js'
import { portraitPrompt } from './prompts/portrait.prompt.js'
import { readJpegResponse } from './google-gemini-response.js'

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
    if (!this.apiKey?.trim()) {
      throw new Error('Gemini API key is not configured.')
    }

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: portraitPrompt(input),
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: '9:16' },
      },
    })

    return readJpegResponse(response, 'portrait')
  }
}
