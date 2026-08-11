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

  it('sends persisted JPEG portraits as multimodal references for the final illustration', async () => {
    const create = vi.fn().mockResolvedValue({ output_image: { data: Buffer.from([3]).toString('base64'), mime_type: 'image/jpeg' } })
    const adapter = new GoogleGeminiIllustrationAdapter('key', 'gemini-3.1-flash-lite-image')
    installClient(adapter, create)
    const first = Buffer.from([0xff, 0xd8, 1, 0xff, 0xd9])
    const second = Buffer.from([0xff, 0xd8, 2, 0xff, 0xd9])

    const illustration = await adapter.generateIllustration({
      chapterName: 'Opening',
      chapterPrompt: 'scene',
      style: 'watercolor',
      characterReferences: [
        { name: 'Mina', prompt: 'Mina visual direction', imageBytes: first, mimeType: 'image/jpeg' },
        { name: 'Theo', prompt: 'Theo visual direction', imageBytes: second, mimeType: 'image/jpeg' },
      ],
    })

    expect([...illustration.bytes]).toEqual([3])
    expect(illustration.mimeType).toBe('image/jpeg')
    const request = create.mock.calls[0]?.[0] as { input: Array<Record<string, unknown>>, response_format: Record<string, unknown> }
    expect(request.response_format).toEqual(expect.objectContaining({ mime_type: 'image/jpeg', aspect_ratio: '3:2' }))
    expect(request.input.filter((part) => part.type === 'image')).toEqual([
      { type: 'image', mime_type: 'image/jpeg', data: first.toString('base64') },
      { type: 'image', mime_type: 'image/jpeg', data: second.toString('base64') },
    ])
    expect(JSON.stringify(request.input)).toContain('Mina')
    expect(JSON.stringify(request.input)).toContain('Theo')
  })

  it('rejects illustration generation without one or two portrait references before the provider call', async () => {
    const create = vi.fn()
    const adapter = new GoogleGeminiIllustrationAdapter('key', 'gemini-3.1-flash-lite-image')
    installClient(adapter, create)
    await expect(adapter.generateIllustration({ chapterName: 'Opening', chapterPrompt: 'scene', style: 'watercolor', characterReferences: [] })).rejects.toThrow('One or two portrait references are required.')
    expect(create).not.toHaveBeenCalled()
  })
})
