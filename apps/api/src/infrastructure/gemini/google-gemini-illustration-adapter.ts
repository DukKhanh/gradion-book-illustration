import { GoogleGenAI } from '@google/genai'

import type { IllustrationCharacterReference, IllustrationGenerator } from '../../modules/pipeline/illustrations/illustration-generator.port.js'
import { illustrationPrompt } from './prompts/illustration.prompt.js'
import { readJpegResponse } from './google-gemini-response.js'

export class GoogleGeminiIllustrationAdapter implements IllustrationGenerator {
  private readonly client: GoogleGenAI

  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string,
  ) {
    this.client = new GoogleGenAI({ apiKey: apiKey ?? '' })
  }

  async generateIllustration(input: {
    chapterName: string
    chapterPrompt: string
    style: string
    characterReferences: IllustrationCharacterReference[]
  }): Promise<{ bytes: Uint8Array, mimeType: string }> {
    if (!this.apiKey?.trim()) {
      throw new Error('Gemini API key is not configured.')
    }
    if (input.characterReferences.length < 1 || input.characterReferences.length > 2) {
      throw new Error('One or two portrait references are required.')
    }

    const prompt = illustrationPrompt({
      chapterName: input.chapterName,
      chapterPrompt: input.chapterPrompt,
      style: input.style,
      characterReferences: input.characterReferences.map(({ name, prompt: characterPrompt }) => ({
        name,
        prompt: characterPrompt,
      })),
    })

    const parts = [
      { text: prompt },
      ...input.characterReferences.flatMap((character, index) => [
        { text: `Portrait reference ${index + 1}: ${character.name}` },
        {
          inlineData: {
            mimeType: character.mimeType,
            data: Buffer.from(character.imageBytes).toString('base64'),
          },
        },
      ]),
    ]

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: '3:2' },
      },
    })

    return readJpegResponse(response, 'illustration')
  }
}
