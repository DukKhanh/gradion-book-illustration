import { HttpError } from '../../../shared/http-error.js'
import { IllustrationsRepository } from './illustrations.repository.js'
import type { IllustrationReader } from './illustration-reader.port.js'

export class IllustrationService {
  constructor(private readonly illustrations: IllustrationsRepository, private readonly storage: IllustrationReader) {}

  async read(userId: string, projectId: string, chapterId: string): Promise<Buffer> {
    const imagePath = await this.illustrations.findCompletedForUser({ projectId, userId, chapterId })
    if (!imagePath || !await this.storage.illustrationExists(imagePath)) throw new HttpError('Illustration not found.', 404)
    return this.storage.readIllustration(imagePath)
  }
}
