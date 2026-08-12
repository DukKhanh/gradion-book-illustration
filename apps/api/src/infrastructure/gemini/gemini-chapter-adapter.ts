export interface GeminiChapterAdapter {
  generateChapter(input: {
    bookFileUri: string
    style: string
    characters: Array<{ name: string, prompt: string }>
  }): Promise<unknown>
}
