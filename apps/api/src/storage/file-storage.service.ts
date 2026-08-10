import {
  mkdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const defaultBooksDirectory = fileURLToPath(
  new URL('../../../../data/books/', import.meta.url),
)

export class FileStorageService {
  constructor(
    private readonly booksDirectory = defaultBooksDirectory,
  ) {}

  async writeBook(input: {
    userId: string
    projectId: string
    content: string
  }): Promise<string> {
    const directory = join(
      this.booksDirectory,
      input.userId,
      input.projectId,
    )
    const bookPath = join(directory, 'book.txt')
    await mkdir(directory, { recursive: true })
    await writeFile(bookPath, input.content, 'utf8')
    return bookPath
  }

  async deleteBook(bookPath: string): Promise<void> {
    await rm(bookPath, { force: true })
  }
}
