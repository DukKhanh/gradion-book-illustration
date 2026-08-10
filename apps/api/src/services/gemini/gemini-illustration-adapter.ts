export interface GeminiIllustrationAdapter {
  generateIllustration(input: {
    chapterName: string
    chapterPrompt: string
    style: string
  }): Promise<{ bytes: Uint8Array, mimeType: string }>
}
