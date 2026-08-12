export interface GeminiPortraitAdapter {
  generatePortrait(input: {
    characterName: string
    characterPrompt: string
    style: string
  }): Promise<{ bytes: Uint8Array, mimeType: string }>
}
