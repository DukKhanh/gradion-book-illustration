import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import type { FileStorageService } from '../../infrastructure/storage/file-storage.service.js'
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

  it('exposes only safe Gemini book preparation state in project detail', async () => {
    const startedAt = new Date('2026-01-02T03:04:05.000Z')
    const projects = {
      findByIdForUser: vi.fn().mockResolvedValue({
        id: 'project-1',
        title: 'A book',
        createdAt: startedAt,
        updatedAt: startedAt,
        completedStep: null,
        runningStep: null,
        stepState: 'IDLE',
        stepStartedAt: null,
        stepError: null,
        style: null,
        geminiBookState: 'FAILED',
        geminiBookStartedAt: startedAt,
        geminiBookError: 'Gemini book preparation failed.',
        geminiBookFileUri: 'provider://private-file',
        geminiBookInteractionId: 'private-interaction',
        bookFilePath: 'data/books/user-1/project-1/book.txt',
      }),
      listCharactersForProjectForUser: vi.fn().mockResolvedValue([]),
      listChaptersForProjectForUser: vi.fn().mockResolvedValue([]),
    } as unknown as ProjectRepository
    const service = new ProjectService(projects, {} as FileStorageService)

    const detail = await service.detail('user-1', 'project-1')

    expect(detail.geminiBook).toEqual({
      state: 'FAILED',
      startedAt,
      error: 'Gemini book preparation failed.',
    })
    expect(detail).not.toHaveProperty('geminiBookFileUri')
    expect(detail).not.toHaveProperty('geminiBookInteractionId')
    expect(detail).not.toHaveProperty('bookFilePath')
  })
  it('reads the full owned book text from private local storage', async () => {
    const bookFilePath = '/private/user-1/project-1/book.txt'
    const projects = {
      findByIdForUser: vi.fn().mockResolvedValue({ id: 'project-1', bookFilePath }),
    } as unknown as ProjectRepository
    const storage = {
      readBook: vi.fn().mockResolvedValue('Chapter One\n\nFull original text.'),
    } as unknown as FileStorageService
    const service = new ProjectService(projects, storage)

    await expect(service.bookText('user-1', 'project-1'))
      .resolves.toBe('Chapter One\n\nFull original text.')
    expect(storage.readBook).toHaveBeenCalledWith(bookFilePath)
  })

  it('does not read book storage when the project is not owned', async () => {
    const projects = {
      findByIdForUser: vi.fn().mockResolvedValue(null),
    } as unknown as ProjectRepository
    const storage = { readBook: vi.fn() } as unknown as FileStorageService
    const service = new ProjectService(projects, storage)

    await expect(service.bookText('user-2', 'project-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Project not found.',
    })
    expect(storage.readBook).not.toHaveBeenCalled()
  })

  it('returns a safe error when the durable source book cannot be read', async () => {
    const projects = {
      findByIdForUser: vi.fn().mockResolvedValue({
        id: 'project-1',
        bookFilePath: '/missing/book.txt',
      }),
    } as unknown as ProjectRepository
    const storage = {
      readBook: vi.fn().mockRejectedValue(new Error('ENOENT')),
    } as unknown as FileStorageService
    const service = new ProjectService(projects, storage)

    await expect(service.bookText('user-1', 'project-1')).rejects.toMatchObject({
      statusCode: 500,
      message: 'Book text could not be read.',
    })
  })

})
