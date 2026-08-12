export interface CharacterGenerator {
  generateCharacters(input: { bookFileUri: string, style: string }): Promise<unknown>
}

export type GeminiCharactersAdapter = CharacterGenerator
