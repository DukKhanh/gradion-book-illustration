export interface ChapterGenerator {
  generateChapter(input: { bookFileUri: string, style: string, characters: Array<{ name: string, prompt: string }> }): Promise<unknown>
}

export type GeminiChapterAdapter = ChapterGenerator
