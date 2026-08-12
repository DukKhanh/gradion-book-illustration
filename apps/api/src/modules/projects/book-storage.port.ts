export interface BookStorage {
  writeBook(input: { userId: string, projectId: string, content: string }): Promise<string>
  deleteBook(bookPath: string): Promise<void>
  readBook(bookPath: string): Promise<string>
}
