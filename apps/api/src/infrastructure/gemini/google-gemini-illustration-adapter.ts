import { GoogleGenAI } from '@google/genai'

import type { IllustrationCharacterReference, IllustrationGenerator } from '../../modules/pipeline/illustrations/illustration-generator.port.js'
import { illustrationPrompt } from './prompts/illustration.prompt.js'

export class GoogleGeminiIllustrationAdapter implements IllustrationGenerator {
  private readonly client: GoogleGenAI

  constructor(private readonly apiKey: string | undefined, private readonly model: string) {
    this.client = new GoogleGenAI({ apiKey: apiKey ?? '' })
  }

  async generateIllustration(input: {
    chapterName: string
    chapterPrompt: string
    style: string
    characterReferences: IllustrationCharacterReference[]
  }): Promise<{ bytes: Uint8Array, mimeType: string }> {
    if (!this.apiKey?.trim()) throw new Error('Gemini API key is not configured.')
    if (input.characterReferences.length < 1 || input.characterReferences.length > 2) throw new Error('One or two portrait references are required.')

    const prompt = illustrationPrompt({
      chapterName: input.chapterName,
      chapterPrompt: input.chapterPrompt,
      style: input.style,
      characterReferences: input.characterReferences.map(({ name, prompt: characterPrompt }) => ({ name, prompt: characterPrompt })),
    })

    const interactionInput = [
      { type: 'text' as const, text: prompt },
      ...input.characterReferences.flatMap((character, index) => [
        { type: 'text' as const, text: `Portrait reference ${index + 1}: ${character.name}` },
        { type: 'image' as const, mime_type: character.mimeType, data: Buffer.from(character.imageBytes).toString('base64') },
      ]),
    ]

    const interaction = await this.client.interactions.create({
      model: this.model,
      input: interactionInput,
      response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: '3:2' },
    })
    const image = interaction.output_image
    if (!image?.data || image.mime_type !== 'image/jpeg') throw new Error('Gemini did not return a JPEG illustration.')
    const bytes = Buffer.from(image.data, 'base64')
    if (bytes.length === 0) throw new Error('Gemini returned an empty illustration.')
    return { bytes, mimeType: image.mime_type }
  }
}
