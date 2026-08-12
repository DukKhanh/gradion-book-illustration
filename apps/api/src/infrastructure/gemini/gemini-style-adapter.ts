export interface GeminiStyleAdapter {
  generateStyle(input: { bookFileUri: string }): Promise<unknown>
}
