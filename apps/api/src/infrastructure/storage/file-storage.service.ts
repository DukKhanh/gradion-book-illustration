import {
  access,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { GeminiBookStorage } from '../../modules/gemini-book/gemini-book.service.js'
import type { IllustrationReader } from '../../modules/pipeline/illustrations/illustration-reader.port.js'
import type { IllustrationStorage } from '../../modules/pipeline/illustrations/illustrations-step.executor.js'
import type { PortraitReader } from '../../modules/pipeline/portraits/portrait-reader.port.js'
import type { PortraitStorage } from '../../modules/pipeline/portraits/portraits-step.executor.js'
import type { BookStorage } from '../../modules/projects/book-storage.port.js'

const defaultBooksDirectory = fileURLToPath(
  new URL('../../../../data/books/', import.meta.url),
)
const defaultImagesDirectory = fileURLToPath(
  new URL('../../../../data/images/', import.meta.url),
)

export class FileStorageService implements BookStorage, GeminiBookStorage, PortraitStorage, PortraitReader, IllustrationStorage, IllustrationReader {
  constructor(
    private readonly booksDirectory = defaultBooksDirectory,
    private readonly imagesDirectory = defaultImagesDirectory,
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

  async readBook(bookPath: string): Promise<string> {
    return readFile(bookPath, 'utf8')
  }

  async writePortrait(input: {
    userId: string
    projectId: string
    characterId: string
    stepStartedAt: Date
    bytes: Uint8Array
  }): Promise<string> {
    const directory = join(
      this.imagesDirectory,
      input.userId,
      input.projectId,
      'characters',
      input.characterId,
    )
    const portraitPath = join(
      directory,
      `${input.stepStartedAt.getTime()}.jpg`,
    )
    await mkdir(directory, { recursive: true })
    await writeFile(portraitPath, input.bytes)
    return portraitPath
  }

  async readPortrait(portraitPath: string): Promise<Buffer> {
    return readFile(portraitPath)
  }

  async portraitExists(portraitPath: string): Promise<boolean> {
    try {
      await access(portraitPath)
      return true
    } catch {
      return false
    }
  }

  async deletePortrait(portraitPath: string): Promise<void> {
    await rm(portraitPath, { force: true })
  }

  async writeIllustration(input: {
    userId: string
    projectId: string
    chapterId: string
    stepStartedAt: Date
    bytes: Uint8Array
  }): Promise<string> {
    const directory = join(this.imagesDirectory, input.userId, input.projectId, 'chapters', input.chapterId)
    const illustrationPath = join(directory, `${input.stepStartedAt.getTime()}.jpg`)
    await mkdir(directory, { recursive: true })
    await writeFile(illustrationPath, input.bytes)
    return illustrationPath
  }

  async readIllustration(illustrationPath: string): Promise<Buffer> {
    return readFile(illustrationPath)
  }

  async illustrationExists(illustrationPath: string): Promise<boolean> {
    try { await access(illustrationPath); return true } catch { return false }
  }

  async deleteIllustration(illustrationPath: string): Promise<void> {
    await rm(illustrationPath, { force: true })
  }
}
