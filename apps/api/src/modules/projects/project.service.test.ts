import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import type { FileStorageService } from '../../storage/file-storage.service.js'
import type { ProjectRepository } from './project.repository.js'
import { ProjectService } from './project.service.js'

describe('ProjectService', () => {
  it('deletes a written book when project persistence fails', async () => {
    const bookPath = '/temporary/books/user-1/project-1/book.txt'
    const storage = {
      writeBook: vi.fn().mockResolvedValue(bookPath),
      deleteBook: vi.fn().mockResolvedValue(undefined),
    } as unknown as FileStorageService
    const projects = {
      create: vi.fn().mockRejectedValue(new Error('database unavailable')),
    } as unknown as ProjectRepository
    const service = new ProjectService(projects, storage)

    await expect(
      service.create({
        userId: 'user-1',
        title: 'Compensation test',
        bookText: 'A persisted book.',
      }),
    ).rejects.toMatchObject({
      statusCode: 500,
      message: 'Could not create project.',
    })

    expect(storage.writeBook).toHaveBeenCalledOnce()
    expect(storage.deleteBook).toHaveBeenCalledWith(bookPath)
  })
})
