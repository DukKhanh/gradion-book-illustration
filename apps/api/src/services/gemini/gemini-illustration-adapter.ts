export type IllustrationCharacterReference = {
  name: string
  prompt: string
  imageBytes: Uint8Array
  mimeType: 'image/jpeg'
}

export interface GeminiIllustrationAdapter {
  generateIllustration(input: {
    chapterName: string
    chapterPrompt: string
    style: string
    characterReferences: IllustrationCharacterReference[]
  }): Promise<{ bytes: Uint8Array, mimeType: string }>
}
