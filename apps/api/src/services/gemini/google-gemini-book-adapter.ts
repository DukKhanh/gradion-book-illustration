import { GoogleGenAI } from '@google/genai'

import type { GeminiBookAdapter } from './gemini-book-adapter.js'

export class GoogleGeminiBookAdapter implements GeminiBookAdapter {
  private readonly client: GoogleGenAI

  constructor(apiKey: string | undefined) {
    this.client = new GoogleGenAI({ apiKey: apiKey ?? '' })
  }

  async uploadBook(input: {
    content: string
    displayName: string
  }): Promise<{ uri: string }> {
    const file = await this.client.files.upload({
      file: new Blob([input.content], { type: 'text/plain' }),
      config: {
        displayName: input.displayName,
        mimeType: 'text/plain',
      },
    })

    if (!file.uri) {
      throw new Error('Gemini did not return a file URI.')
    }

    return { uri: file.uri }
  }
}
