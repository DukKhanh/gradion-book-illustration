export interface GeminiCharactersAdapter {
  generateCharacters(input: {
    bookFileUri: string
    style: string
  }): Promise<unknown>
}
