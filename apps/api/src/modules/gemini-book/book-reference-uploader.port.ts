export interface BookReferenceUploader {
  uploadBook(input: { content: string, displayName: string }): Promise<{ uri: string }>
}

export type GeminiBookAdapter = BookReferenceUploader
