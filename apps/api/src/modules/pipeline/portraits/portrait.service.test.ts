import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { PortraitService } from './portrait.service.js'
import { PortraitsRepository } from './portraits.repository.js'
import { FileStorageService } from '../../../storage/file-storage.service.js'

describe('PortraitService', () => {
  it('returns only an owned durable portrait file', async () => {
    const repository = {
      findCompletedForUser: vi.fn().mockResolvedValue('/images/portrait.png'),
    } as unknown as PortraitsRepository
    const storage = {
      portraitExists: vi.fn().mockResolvedValue(true),
      readPortrait: vi.fn().mockResolvedValue(Buffer.from([1, 2])),
    } as unknown as FileStorageService
    const service = new PortraitService(repository, storage)
    await expect(service.read('user-1', 'project-1', 'character-1')).resolves.toEqual(Buffer.from([1, 2]))
  })

  it('does not serve missing or non-durable portraits', async () => {
    const repository = {
      findCompletedForUser: vi.fn().mockResolvedValue(null),
    } as unknown as PortraitsRepository
    const storage = {} as FileStorageService
    await expect(new PortraitService(repository, storage).read('user-1', 'project-1', 'character-1'))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  it('does not serve DONE metadata when the stored portrait file is missing', async () => {
    const repository = {
      findCompletedForUser: vi.fn().mockResolvedValue('/images/missing.png'),
    } as unknown as PortraitsRepository
    const storage = {
      portraitExists: vi.fn().mockResolvedValue(false),
      readPortrait: vi.fn(),
    } as unknown as FileStorageService

    await expect(new PortraitService(repository, storage).read('user-1', 'project-1', 'character-1'))
      .rejects.toMatchObject({ statusCode: 404, message: 'Portrait not found.' })
    expect(storage.readPortrait).not.toHaveBeenCalled()
  })
})

describe('portrait local storage', () => {
  it('uses a Windows-safe run-scoped JPEG path', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'gradion-portrait-'))
    try {
      const path = await new FileStorageService(directory, directory).writePortrait({
        userId: 'user-1', projectId: 'project-1', characterId: 'character-1',
        stepStartedAt: new Date('2026-08-11T10:00:00.000Z'), bytes: new Uint8Array([1]),
      })
      expect(path).toBe(join(directory, 'user-1', 'project-1', 'characters', 'character-1', '1786442400000.jpg'))
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
})
