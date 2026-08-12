import { HttpError } from '../../../shared/http-error.js'
import { FileStorageService } from '../../../infrastructure/storage/file-storage.service.js'
import { PortraitsRepository } from './portraits.repository.js'

export class PortraitService {
  constructor(
    private readonly portraits: PortraitsRepository,
    private readonly storage: FileStorageService,
  ) {}

  async read(userId: string, projectId: string, characterId: string): Promise<Buffer> {
    const imagePath = await this.portraits.findCompletedForUser({ projectId, userId, characterId })
    if (!imagePath || !await this.storage.portraitExists(imagePath)) {
      throw new HttpError('Portrait not found.', 404)
    }
    return this.storage.readPortrait(imagePath)
  }
}
