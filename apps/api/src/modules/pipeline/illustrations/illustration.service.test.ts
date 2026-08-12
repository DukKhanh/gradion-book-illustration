import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { FileStorageService } from '../../../infrastructure/storage/file-storage.service.js'
import { IllustrationsRepository } from './illustrations.repository.js'
import { IllustrationService } from './illustration.service.js'

describe('IllustrationService', () => {
  it('does not read a missing durable illustration file', async () => {
    const repository = { findCompletedForUser: vi.fn().mockResolvedValue('/images/missing.png') } as unknown as IllustrationsRepository
    const storage = { illustrationExists: vi.fn().mockResolvedValue(false), readIllustration: vi.fn() } as unknown as FileStorageService
    await expect(new IllustrationService(repository, storage).read('user-1', 'project-1', 'chapter-1')).rejects.toMatchObject({ statusCode: 404, message: 'Illustration not found.' })
    expect(storage.readIllustration).not.toHaveBeenCalled()
  })

  it('does not reveal a non-owned illustration', async () => {
    const repository = { findCompletedForUser: vi.fn().mockResolvedValue(null) } as unknown as IllustrationsRepository
    const storage = { illustrationExists: vi.fn(), readIllustration: vi.fn() } as unknown as FileStorageService
    await expect(new IllustrationService(repository, storage).read('user-b', 'project-a', 'chapter-1')).rejects.toMatchObject({ statusCode: 404 })
    expect(storage.readIllustration).not.toHaveBeenCalled()
  })
})

describe('illustration local storage', () => {
  it('uses a Windows-safe run-scoped chapter path', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'gradion-illustration-'))
const { FileStorageService } = await import('../../../infrastructure/storage/file-storage.service.js')
    try {
      const path = await new FileStorageService(directory, directory).writeIllustration({
        userId: 'user-1', projectId: 'project-1', chapterId: 'chapter-1',
        stepStartedAt: new Date('2026-08-11T10:00:00.000Z'), bytes: new Uint8Array([1]),
      })
      expect(path).toBe(join(directory, 'user-1', 'project-1', 'chapters', 'chapter-1', '1786442400000.jpg'))
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
})
