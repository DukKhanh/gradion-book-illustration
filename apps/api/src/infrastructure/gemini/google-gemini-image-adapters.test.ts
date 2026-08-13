import { describe, expect, it, vi } from 'vitest'

import { GoogleGeminiPortraitAdapter } from './google-gemini-portrait-adapter.js'
import { GoogleGeminiIllustrationAdapter } from './google-gemini-illustration-adapter.js'

function imageResponse(bytes: number[]) {
  return {
    candidates: [{
      content: {
        parts: [{ inlineData: { data: Buffer.from(bytes).toString('base64'), mimeType: 'image/jpeg' } }],
      },
    }],
  }
}

function installClient(adapter: object, generateContent: ReturnType<typeof vi.fn>) {
  Reflect.set(adapter, 'client', { models: { generateContent } })
}

describe('Google Gemini image adapters', () => {
  it('requests and accepts JPEG portraits through generateContent', async () => {
    const generateContent = vi.fn().mockResolvedValue(imageResponse([1, 2]))
    const adapter = new GoogleGeminiPortraitAdapter('key', 'gemini-3.1-flash-lite-image')
    installClient(adapter, generateContent)

    const portrait = await adapter.generatePortrait({ characterName: 'Mina', characterPrompt: 'portrait', style: 'watercolor' })
    expect([...portrait.bytes]).toEqual([1, 2])
    expect(portrait.mimeType).toBe('image/jpeg')
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({ responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '9:16' } }),
    }))
  })

  it('sends persisted JPEG portraits as inline multimodal references for the final illustration', async () => {
    const generateContent = vi.fn().mockResolvedValue(imageResponse([3]))
    const adapter = new GoogleGeminiIllustrationAdapter('key', 'gemini-3.1-flash-lite-image')
    installClient(adapter, generateContent)
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
    const request = generateContent.mock.calls[0]?.[0]
    expect(request.config).toEqual(expect.objectContaining({ responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '3:2' } }))
    const parts = request.contents[0].parts as Array<Record<string, unknown>>
    expect(parts.filter((part) => 'inlineData' in part)).toEqual([
      { inlineData: { mimeType: 'image/jpeg', data: first.toString('base64') } },
      { inlineData: { mimeType: 'image/jpeg', data: second.toString('base64') } },
    ])
    expect(JSON.stringify(parts)).toContain('Mina')
    expect(JSON.stringify(parts)).toContain('Theo')
  })

  it('rejects illustration generation without one or two portrait references before the provider call', async () => {
    const generateContent = vi.fn()
    const adapter = new GoogleGeminiIllustrationAdapter('key', 'gemini-3.1-flash-lite-image')
    installClient(adapter, generateContent)
    await expect(adapter.generateIllustration({ chapterName: 'Opening', chapterPrompt: 'scene', style: 'watercolor', characterReferences: [] })).rejects.toThrow('One or two portrait references are required.')
    expect(generateContent).not.toHaveBeenCalled()
  })
})
