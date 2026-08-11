import { describe, expect, it, vi } from 'vitest'

import { GoogleGeminiPortraitAdapter } from './google-gemini-portrait-adapter.js'
import { GoogleGeminiIllustrationAdapter } from './google-gemini-illustration-adapter.js'

function installClient(adapter: object, create: ReturnType<typeof vi.fn>) {
  Reflect.set(adapter, 'client', { interactions: { create } })
}

describe('Google Gemini image adapters', () => {
  it('requests and accepts JPEG portraits', async () => {
    const create = vi.fn().mockResolvedValue({ output_image: { data: Buffer.from([1, 2]).toString('base64'), mime_type: 'image/jpeg' } })
    const adapter = new GoogleGeminiPortraitAdapter('key', 'gemini-3.1-flash-lite-image')
    installClient(adapter, create)

    const portrait = await adapter.generatePortrait({ characterName: 'Mina', characterPrompt: 'portrait', style: 'watercolor' })
    expect([...portrait.bytes]).toEqual([1, 2])
    expect(portrait.mimeType).toBe('image/jpeg')
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ response_format: expect.objectContaining({ mime_type: 'image/jpeg', aspect_ratio: '9:16' }) }))
  })

  it('requests and accepts JPEG illustrations', async () => {
    const create = vi.fn().mockResolvedValue({ output_image: { data: Buffer.from([3]).toString('base64'), mime_type: 'image/jpeg' } })
    const adapter = new GoogleGeminiIllustrationAdapter('key', 'gemini-3.1-flash-lite-image')
    installClient(adapter, create)

    const illustration = await adapter.generateIllustration({ chapterName: 'Opening', chapterPrompt: 'scene', style: 'watercolor' })
    expect([...illustration.bytes]).toEqual([3])
    expect(illustration.mimeType).toBe('image/jpeg')
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ response_format: expect.objectContaining({ mime_type: 'image/jpeg', aspect_ratio: '3:2' }) }))
  })
})
