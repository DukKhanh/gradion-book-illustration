import { describe, expect, it, vi } from 'vitest'

import { IllustrationController } from './illustration.controller.js'
import { IllustrationService } from './illustration.service.js'

describe('IllustrationController', () => {
  it('serves a durable illustration as JPEG', async () => {
    const service = { read: vi.fn().mockResolvedValue(Buffer.from([1])) } as unknown as IllustrationService
    const controller = new IllustrationController(service)
    const type = vi.fn().mockReturnThis()
    const send = vi.fn()

    await controller.read(
      { params: { projectId: 'project-1', chapterId: 'chapter-1' }, session: { userId: 'user-1' } } as never,
      { type, send } as never,
      vi.fn(),
    )

    expect(type).toHaveBeenCalledWith('image/jpeg')
    expect(send).toHaveBeenCalledWith(Buffer.from([1]))
  })
})
