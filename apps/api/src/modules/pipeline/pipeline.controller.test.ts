import { describe, expect, it, vi } from 'vitest'

import { PipelineController } from './pipeline.controller.js'

describe('PipelineController', () => {
  it('rejects a style body for a non-STYLE step before execution', async () => {
    const service = { run: vi.fn() }
    const controller = new PipelineController(service as never)
    const next = vi.fn()

    await controller.run(
      {
        session: { userId: 'user-1' },
        params: { projectId: 'project-1', step: 'CHARACTERS' },
        body: { style: 'watercolor' },
      } as never,
      {} as never,
      next,
    )

    expect(service.run).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
    }))
  })
})
