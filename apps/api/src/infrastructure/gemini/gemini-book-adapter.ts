export interface GeminiBookAdapter {
  uploadBook(input: {
    content: string
    displayName: string
  }): Promise<{ uri: string }>
}
