export interface StyleGenerator {
  generateStyle(input: { bookFileUri: string }): Promise<unknown>
}

export type GeminiStyleAdapter = StyleGenerator
