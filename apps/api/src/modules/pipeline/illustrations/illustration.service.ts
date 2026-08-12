import { HttpError } from '../../../shared/http-error.js'
import { FileStorageService } from '../../../infrastructure/storage/file-storage.service.js'
import { IllustrationsRepository } from './illustrations.repository.js'

export class IllustrationService {
  constructor(private readonly illustrations: IllustrationsRepository, private readonly storage: FileStorageService) {}

  async read(userId: string, projectId: string, chapterId: string): Promise<Buffer> {
    const imagePath = await this.illustrations.findCompletedForUser({ projectId, userId, chapterId })
    if (!imagePath || !await this.storage.illustrationExists(imagePath)) throw new HttpError('Illustration not found.', 404)
    return this.storage.readIllustration(imagePath)
  }
}
