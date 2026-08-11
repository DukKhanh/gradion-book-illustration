import { describe, expect, it, vi } from 'vitest'

import { PortraitController } from './portrait.controller.js'
import { PortraitService } from './portrait.service.js'

describe('PortraitController', () => {
  it('serves a durable portrait as JPEG', async () => {
    const service = { read: vi.fn().mockResolvedValue(Buffer.from([1])) } as unknown as PortraitService
    const controller = new PortraitController(service)
    const type = vi.fn().mockReturnThis()
    const send = vi.fn()

    await controller.read(
      { params: { projectId: 'project-1', characterId: 'character-1' }, session: { userId: 'user-1' } } as never,
      { type, send } as never,
      vi.fn(),
    )

    expect(type).toHaveBeenCalledWith('image/jpeg')
    expect(send).toHaveBeenCalledWith(Buffer.from([1]))
  })
})
