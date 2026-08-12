import { HttpError } from '../../../shared/http-error.js'
import { PortraitsRepository } from './portraits.repository.js'
import type { PortraitReader } from './portrait-reader.port.js'

export class PortraitService {
  constructor(
    private readonly portraits: PortraitsRepository,
    private readonly storage: PortraitReader,
  ) {}

  async read(userId: string, projectId: string, characterId: string): Promise<Buffer> {
    const imagePath = await this.portraits.findCompletedForUser({ projectId, userId, characterId })
    if (!imagePath || !await this.storage.portraitExists(imagePath)) {
      throw new HttpError('Portrait not found.', 404)
    }
    return this.storage.readPortrait(imagePath)
  }
}
