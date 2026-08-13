import { describe, expect, it, vi } from 'vitest'

import { GoogleGeminiStyleAdapter } from './google-gemini-style-adapter.js'
import { GoogleGeminiCharactersAdapter } from './google-gemini-characters-adapter.js'
import { GoogleGeminiChapterAdapter } from './google-gemini-chapter-adapter.js'

function installClient(adapter: object, generateContent: ReturnType<typeof vi.fn>) {
  Reflect.set(adapter, 'client', { models: { generateContent } })
}

describe('Google Gemini text adapters', () => {
  it('generates STYLE with a stateless generateContent request and a reusable file reference', async () => {
    const generateContent = vi.fn().mockResolvedValue({ text: JSON.stringify({ style: 'watercolor' }) })
    const adapter = new GoogleGeminiStyleAdapter('key', 'gemini-2.5-flash')
    installClient(adapter, generateContent)

    await expect(adapter.generateStyle({ bookFileUri: 'https://provider/book' })).resolves.toEqual({ style: 'watercolor' })

    expect(generateContent).toHaveBeenCalledOnce()
    const request = generateContent.mock.calls[0]?.[0]
    expect(request).toEqual(expect.objectContaining({
      model: 'gemini-2.5-flash',
      config: expect.objectContaining({ responseMimeType: 'application/json' }),
    }))
    expect(JSON.stringify(request.contents)).toContain('https://provider/book')
    expect(JSON.stringify(request)).not.toContain('previous_interaction_id')
  })

  it('generates CHARACTERS from persisted STYLE plus the reusable book file reference', async () => {
    const payload = { characters: [{ name: 'Mina', prompt: 'portrait', isAdult: true }] }
    const generateContent = vi.fn().mockResolvedValue({ text: JSON.stringify(payload) })
    const adapter = new GoogleGeminiCharactersAdapter('key', 'gemini-2.5-flash')
    installClient(adapter, generateContent)

    await expect(adapter.generateCharacters({ bookFileUri: 'https://provider/book', style: 'watercolor' })).resolves.toEqual(payload)

    const request = generateContent.mock.calls[0]?.[0]
    expect(JSON.stringify(request.contents)).toContain('Art direction: watercolor')
    expect(JSON.stringify(request.contents)).toContain('https://provider/book')
  })

  it('generates CHAPTERS from persisted STYLE and CHARACTERS without provider conversation state', async () => {
    const payload = { chapter: { name: 'Opening', prompt: 'riverbank scene' } }
    const generateContent = vi.fn().mockResolvedValue({ text: JSON.stringify(payload) })
    const adapter = new GoogleGeminiChapterAdapter('key', 'gemini-2.5-flash')
    installClient(adapter, generateContent)

    await expect(adapter.generateChapter({
      bookFileUri: 'https://provider/book',
      style: 'watercolor',
      characters: [{ name: 'Mina', prompt: 'portrait' }],
    })).resolves.toEqual(payload)

    const serialized = JSON.stringify(generateContent.mock.calls[0]?.[0])
    expect(serialized).toContain('Art direction: watercolor')
    expect(serialized).toContain('Mina')
    expect(serialized).not.toContain('previous_interaction_id')
  })

  it('rejects an empty provider response instead of persisting an invalid structured result', async () => {
    const generateContent = vi.fn().mockResolvedValue({ text: undefined })
    const adapter = new GoogleGeminiStyleAdapter('key', 'gemini-2.5-flash')
    installClient(adapter, generateContent)

    await expect(adapter.generateStyle({ bookFileUri: 'https://provider/book' })).rejects.toThrow('Gemini did not return STYLE output.')
  })
})
