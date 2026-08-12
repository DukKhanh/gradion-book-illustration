import { describe, expect, it, vi } from 'vitest'
import { IllustrationsRepository } from './illustrations.repository.js'
import { IllustrationService } from './illustration.service.js'
import type { IllustrationReader } from './illustration-reader.port.js'

describe('IllustrationService', () => {
  it('does not read a missing durable illustration file', async () => {
    const repository = { findCompletedForUser: vi.fn().mockResolvedValue('/images/missing.png') } as unknown as IllustrationsRepository
    const storage = { illustrationExists: vi.fn().mockResolvedValue(false), readIllustration: vi.fn() } as unknown as IllustrationReader
    await expect(new IllustrationService(repository, storage).read('user-1', 'project-1', 'chapter-1')).rejects.toMatchObject({ statusCode: 404, message: 'Illustration not found.' })
    expect(storage.readIllustration).not.toHaveBeenCalled()
  })

  it('does not reveal a non-owned illustration', async () => {
    const repository = { findCompletedForUser: vi.fn().mockResolvedValue(null) } as unknown as IllustrationsRepository
    const storage = { illustrationExists: vi.fn(), readIllustration: vi.fn() } as unknown as IllustrationReader
    await expect(new IllustrationService(repository, storage).read('user-b', 'project-a', 'chapter-1')).rejects.toMatchObject({ statusCode: 404 })
    expect(storage.readIllustration).not.toHaveBeenCalled()
  })
})
