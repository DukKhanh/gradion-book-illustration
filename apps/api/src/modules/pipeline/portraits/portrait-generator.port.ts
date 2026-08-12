export interface PortraitGenerator {
  generatePortrait(input: { characterName: string, characterPrompt: string, style: string }): Promise<{ bytes: Uint8Array, mimeType: string }>
}

export type GeminiPortraitAdapter = PortraitGenerator
