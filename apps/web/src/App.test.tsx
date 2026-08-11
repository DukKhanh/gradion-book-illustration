import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'

import App from './App'
import { SessionProvider } from './features/session/SessionProvider'
import { queryClient } from './query-client'
import { sessionKey } from './api/session'

const user = { id: 'user-1', name: 'Ada', email: 'ada@example.test', createdAt: '2026-01-01T00:00:00.000Z' }
const emptyPipeline = { completedStep: null, runningStep: null, stepState: 'IDLE', stepStartedAt: null, stepError: null }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function renderApp(path = '/') {
  window.history.pushState({}, '', path)
  return render(<QueryClientProvider client={queryClient}><BrowserRouter><SessionProvider><App /></SessionProvider></BrowserRouter></QueryClientProvider>)
}

beforeEach(() => {
  queryClient.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  queryClient.clear()
})

describe('frontend project flow', () => {
  it('waits for session bootstrap before deciding a deep protected route', async () => {
    let resolveSession: ((response: Response) => void) | undefined
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { resolveSession = resolve })))
    renderApp('/projects/project-1')
    expect(screen.getByText('Checking your session…')).not.toBeNull()
    resolveSession?.(json({ user }))
    await screen.findByText('Loading project…')
  })

  it('redirects an authenticated visitor from the welcome page to projects', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/session') return Promise.resolve(json({ user }))
      return Promise.resolve(json({ projects: [] }))
    }))
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Your projects' })).not.toBeNull()
  })

  it('returns to the identity flow when an authenticated project request returns 401', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/session') return Promise.resolve(json({ user }))
      if (url === '/api/projects') return Promise.resolve(json({ error: 'Authentication required.' }, 401))
      return Promise.resolve(json({ error: 'Unexpected request' }, 500))
    }))
    renderApp('/projects')
    expect(await screen.findByRole('heading', { name: 'Bring a book to life.' })).not.toBeNull()
    expect(queryClient.getQueryData(sessionKey)).toBeNull()
  })

  it('submits identity through the session API', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/session' && init?.method === 'POST') return Promise.resolve(json({ user }))
      if (url === '/api/session') return Promise.resolve(json(null, 401))
      if (url === '/api/projects') return Promise.resolve(json({ projects: [] }))
      return Promise.resolve(json({ error: 'Unexpected request' }, 500))
    })
    vi.stubGlobal('fetch', fetchMock)
    const ui = userEvent.setup()
    renderApp('/')
    await screen.findByLabelText('Your name')
    await ui.type(screen.getByLabelText('Your name'), 'Ada')
    await ui.type(screen.getByLabelText('Email address'), 'ada@example.test')
    await ui.click(screen.getByRole('button', { name: 'Enter studio' }))
    await screen.findByRole('heading', { name: 'Your projects' })
    expect(fetchMock).toHaveBeenCalledWith('/api/session', expect.objectContaining({ method: 'POST', credentials: 'include' }))
  })

  it('shows a backend identity validation error', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/session' && init?.method === 'POST') return Promise.resolve(json({ error: 'Enter a valid email address.' }, 400))
      return Promise.resolve(json(null, 401))
    }))
    const ui = userEvent.setup()
    renderApp('/')
    await screen.findByLabelText('Your name')
    await ui.type(screen.getByLabelText('Your name'), 'Ada')
    await ui.type(screen.getByLabelText('Email address'), 'bad@example.test')
    await ui.click(screen.getByRole('button', { name: 'Enter studio' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Enter a valid email address.')
  })

  it('destroys the server session when signing out', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/session' && init?.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }))
      if (url === '/api/session') return Promise.resolve(json({ user }))
      if (url === '/api/projects') return Promise.resolve(json({ projects: [] }))
      return Promise.resolve(json({ error: 'Unexpected request' }, 500))
    })
    vi.stubGlobal('fetch', fetchMock)
    const ui = userEvent.setup()
    renderApp('/projects')
    await screen.findByRole('heading', { name: 'Your projects' })
    await ui.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { name: 'Bring a book to life.' })).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledWith('/api/session', expect.objectContaining({ method: 'DELETE' }))
  })

  it('clears an inactive upload when switching to paste text before submit', async () => {
    const fetchMock = authenticatedProjectFetch()
    vi.stubGlobal('fetch', fetchMock)
    const ui = userEvent.setup()
    renderApp('/projects/new')
    await screen.findByLabelText('Project title')
    await ui.type(screen.getByLabelText('Project title'), 'A book')
    await ui.click(screen.getByRole('button', { name: 'Upload .txt' }))
    const file = new File(['book'], 'source.txt', { type: 'text/plain' })
    await ui.upload(screen.getByLabelText('Text file'), file)
    await ui.click(screen.getByRole('button', { name: 'Paste text' }))
    await ui.type(screen.getByLabelText('Book text'), 'A pasted book')
    fireEvent.submit(screen.getByRole('button', { name: 'Create project' }).closest('form')!)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/projects', expect.any(Object)))
    const init = fetchMock.mock.calls.find(([url]) => url === '/api/projects')?.[1] as RequestInit
    const body = init.body as FormData
    expect(body.get('bookText')).toBe('A pasted book')
    expect(body.has('bookFile')).toBe(false)
  })

  it('clears inactive pasted text when switching to upload before submit', async () => {
    const fetchMock = authenticatedProjectFetch()
    vi.stubGlobal('fetch', fetchMock)
    const ui = userEvent.setup()
    renderApp('/projects/new')
    await screen.findByLabelText('Project title')
    await ui.type(screen.getByLabelText('Project title'), 'A book')
    await ui.type(screen.getByLabelText('Book text'), 'Old pasted book')
    await ui.click(screen.getByRole('button', { name: 'Upload .txt' }))
    const file = new File(['book'], 'source.txt', { type: 'text/plain' })
    await ui.upload(screen.getByLabelText('Text file'), file)
    fireEvent.submit(screen.getByRole('button', { name: 'Create project' }).closest('form')!)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/projects', expect.any(Object)))
    const init = fetchMock.mock.calls.find(([url]) => url === '/api/projects')?.[1] as RequestInit
    const body = init.body as FormData
    expect(body.has('bookText')).toBe(false)
    expect(body.get('bookFile')).toBe(file)
  })

  it('renders backend image URLs directly and makes no pipeline request on workspace mount', async () => {
    const detail = {
      id: 'project-1', title: 'Saved book', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', style: 'Watercolor', pipeline: emptyPipeline,
      characters: [{ id: 'character-1', name: 'Mina', prompt: 'A traveler', position: 0, generationStatus: 'DONE', generationError: null, portraitUrl: '/api/projects/project-1/characters/character-1/portrait' }],
      chapters: [{ id: 'chapter-1', name: 'The arrival', prompt: 'Mina arrives', position: 0, generationStatus: 'DONE', generationError: null, illustrationUrl: '/api/projects/project-1/chapters/chapter-1/illustration' }],
    }
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/session') return Promise.resolve(json({ user }))
      if (url === '/api/projects/project-1') return Promise.resolve(json({ project: detail }))
      return Promise.resolve(json({ error: 'Unexpected request' }, 500))
    })
    vi.stubGlobal('fetch', fetchMock)
    renderApp('/projects/project-1')
    expect((await screen.findByAltText('Portrait of Mina')).getAttribute('src')).toBe(detail.characters[0].portraitUrl)
    expect(screen.getByAltText('Illustration for The arrival').getAttribute('src')).toBe(detail.chapters[0].illustrationUrl)
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/pipeline'))).toBe(false)
  })
})

function authenticatedProjectFetch() {
  return vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/session') return Promise.resolve(json({ user }))
    if (url === '/api/projects' && init?.method === 'POST') return Promise.resolve(json({ project: { id: 'project-1', title: 'A book', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', style: null, pipeline: emptyPipeline } }))
    return Promise.resolve(json({ error: 'Unexpected request' }, 500))
  })
}
