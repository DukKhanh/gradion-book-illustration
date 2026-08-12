import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { FileStorageService } from './file-storage.service.js'

describe('FileStorageService', () => {
  it('uses a Windows-safe run-scoped portrait path', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'gradion-storage-'))
    try {
      const storage = new FileStorageService(directory, directory)
      const startedAt = new Date('2026-08-11T10:00:00.000Z')
      const portrait = await storage.writePortrait({ userId: 'user-1', projectId: 'project-1', characterId: 'character-1', stepStartedAt: startedAt, bytes: new Uint8Array([1]) })
      expect(portrait).toBe(join(directory, 'user-1', 'project-1', 'characters', 'character-1', '1786442400000.jpg'))
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('uses a Windows-safe run-scoped illustration path', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'gradion-storage-'))
    try {
      const illustration = await new FileStorageService(directory, directory).writeIllustration({ userId: 'user-1', projectId: 'project-1', chapterId: 'chapter-1', stepStartedAt: new Date('2026-08-11T10:00:00.000Z'), bytes: new Uint8Array([1]) })
      expect(illustration).toBe(join(directory, 'user-1', 'project-1', 'chapters', 'chapter-1', '1786442400000.jpg'))
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
