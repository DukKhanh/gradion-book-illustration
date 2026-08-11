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
const readyBook = { state: 'READY', startedAt: null, error: null }

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
      geminiBook: readyBook,
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
    const chapterIllustration = screen.getByAltText('Illustration for The arrival')
    expect(chapterIllustration.getAttribute('src')).toBe(detail.chapters[0].illustrationUrl)
    expect(chapterIllustration.getAttribute('loading')).toBe('lazy')
    expect(chapterIllustration.closest('.chapter-card__media')).not.toBeNull()
    expect(screen.getByText('Mina arrives').closest('.chapter-card__content')).not.toBeNull()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/pipeline'))).toBe(false)
  })

  it('prepares an idle book only after an explicit click', async () => {
    const detail = projectDetail({ geminiBook: { state: 'IDLE', startedAt: null, error: null } })
    const fetchMock = workspaceFetch(detail)
    vi.stubGlobal('fetch', fetchMock)
    const ui = userEvent.setup()
    renderApp('/projects/project-1')
    expect(await screen.findByRole('button', { name: 'Prepare book for generation' })).not.toBeNull()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/gemini-book'))).toBe(false)
    await ui.click(screen.getByRole('button', { name: 'Prepare book for generation' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/projects/project-1/gemini-book', expect.objectContaining({ method: 'POST' })))
  })

  it('shows a failed book preparation error and permits only an explicit retry', async () => {
    const detail = projectDetail({ geminiBook: { state: 'FAILED', startedAt: null, error: 'Gemini book preparation failed.' } })
    const fetchMock = workspaceFetch(detail)
    vi.stubGlobal('fetch', fetchMock)
    renderApp('/projects/project-1')
    expect((await screen.findByText('Gemini book preparation failed.')).textContent).toContain('failed')
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/gemini-book'))).toBe(false)
  })

  it('uses a trimmed manual style and does not automatically run the next step', async () => {
    const detail = projectDetail()
    const fetchMock = workspaceFetch(detail)
    vi.stubGlobal('fetch', fetchMock)
    const ui = userEvent.setup()
    renderApp('/projects/project-1')
    await screen.findByLabelText('Art direction (optional)')
    await ui.type(screen.getByLabelText('Art direction (optional)'), '  watercolor storybook  ')
    await ui.click(screen.getByRole('button', { name: 'Generate art direction' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/projects/project-1/pipeline/STYLE', expect.any(Object)))
    const styleCall = fetchMock.mock.calls.find(([url]) => url === '/api/projects/project-1/pipeline/STYLE')
    expect(styleCall?.[1]).toMatchObject({ body: JSON.stringify({ style: 'watercolor storybook' }) })
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/pipeline/CHARACTERS'))).toBe(false)
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === '/api/projects/project-1').length).toBeGreaterThan(1))
  })

  it('omits the style body for AI art direction', async () => {
    const fetchMock = workspaceFetch(projectDetail())
    vi.stubGlobal('fetch', fetchMock)
    const ui = userEvent.setup()
    renderApp('/projects/project-1')
    await screen.findByRole('button', { name: 'Generate art direction' })
    await ui.click(screen.getByRole('button', { name: 'Generate art direction' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/projects/project-1/pipeline/STYLE', expect.any(Object)))
    const styleCall = fetchMock.mock.calls.find(([url]) => url === '/api/projects/project-1/pipeline/STYLE')
    expect((styleCall?.[1] as RequestInit).body).toBeUndefined()
  })

  it('retries a failed manual STYLE request with the same trimmed manual value', async () => {
    let detail = projectDetail()
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>((url: string) => {
      if (url === '/api/session') return Promise.resolve(json({ user }))
      if (url === '/api/projects/project-1') return Promise.resolve(json({ project: detail }))
      if (url === '/api/projects/project-1/pipeline/STYLE') {
        if (fetchMock.mock.calls.filter(([calledUrl]) => calledUrl === url).length === 1) {
          detail = projectDetail({ pipeline: { completedStep: null, runningStep: 'STYLE', stepState: 'FAILED', stepStartedAt: null, stepError: 'Generation failed.' } })
          return Promise.resolve(json({ error: 'Pipeline execution failed.' }, 502))
        }
        return Promise.resolve(json({ status: 'completed' }))
      }
      return Promise.resolve(json({ error: 'Unexpected request' }, 500))
    })
    vi.stubGlobal('fetch', fetchMock)
    const ui = userEvent.setup()
    renderApp('/projects/project-1')
    await ui.type(await screen.findByLabelText('Art direction (optional)'), '  watercolor  ')
    await ui.click(screen.getByRole('button', { name: 'Generate art direction' }))
    await screen.findByRole('button', { name: 'Retry art direction' })
    await ui.click(screen.getByRole('button', { name: 'Retry art direction' }))

    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === '/api/projects/project-1/pipeline/STYLE')).toHaveLength(2))
    const retry = fetchMock.mock.calls.filter(([url]) => url === '/api/projects/project-1/pipeline/STYLE')[1][1] as RequestInit
    expect(retry.body).toBe(JSON.stringify({ style: 'watercolor' }))
  })

  it('retries a failed AI STYLE request without a style body', async () => {
    let detail = projectDetail()
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>((url: string) => {
      if (url === '/api/session') return Promise.resolve(json({ user }))
      if (url === '/api/projects/project-1') return Promise.resolve(json({ project: detail }))
      if (url === '/api/projects/project-1/pipeline/STYLE') {
        if (fetchMock.mock.calls.filter(([calledUrl]) => calledUrl === url).length === 1) {
          detail = projectDetail({ pipeline: { completedStep: null, runningStep: 'STYLE', stepState: 'FAILED', stepStartedAt: null, stepError: 'Generation failed.' } })
          return Promise.resolve(json({ error: 'Pipeline execution failed.' }, 502))
        }
        return Promise.resolve(json({ status: 'completed' }))
      }
      return Promise.resolve(json({ error: 'Unexpected request' }, 500))
    })
    vi.stubGlobal('fetch', fetchMock)
    const ui = userEvent.setup()
    renderApp('/projects/project-1')
    await ui.click(await screen.findByRole('button', { name: 'Generate art direction' }))
    await screen.findByRole('button', { name: 'Retry art direction' })
    await ui.click(screen.getByRole('button', { name: 'Retry art direction' }))

    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === '/api/projects/project-1/pipeline/STYLE')).toHaveLength(2))
    const retry = fetchMock.mock.calls.filter(([url]) => url === '/api/projects/project-1/pipeline/STYLE')[1][1] as RequestInit
    expect(retry.body).toBeUndefined()
  })

  it('shows only the failed pipeline step retry and keeps recovery separate while running', async () => {
    const failed = projectDetail({ pipeline: { completedStep: 'CHARACTERS', runningStep: 'PORTRAITS', stepState: 'FAILED', stepStartedAt: null, stepError: 'Generation failed.' } })
    const fetchMock = workspaceFetch(failed)
    vi.stubGlobal('fetch', fetchMock)
    const ui = userEvent.setup()
    renderApp('/projects/project-1')
    expect(await screen.findByRole('button', { name: 'Retry portraits' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Generate chapter' })).toBeNull()
    await ui.click(screen.getByRole('button', { name: 'Retry portraits' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/projects/project-1/pipeline/PORTRAITS', expect.any(Object)))
  })

  it('shows explicit recovery for running book preparation and surfaces a safe conflict', async () => {
    const detail = projectDetail({ geminiBook: { state: 'RUNNING', startedAt: '2026-01-01T00:00:00.000Z', error: null } })
    const fetchMock = workspaceFetch(detail, (url) => url.endsWith('/gemini-book/recover') ? json({ error: 'There is no stale Gemini book preparation.' }, 409) : undefined)
    vi.stubGlobal('fetch', fetchMock)
    const ui = userEvent.setup()
    renderApp('/projects/project-1')
    await screen.findByRole('button', { name: 'Recover interrupted preparation' })
    await ui.click(screen.getByRole('button', { name: 'Recover interrupted preparation' }))
    expect((await screen.findByRole('alert')).textContent).toContain('There is no stale Gemini book preparation.')
  })

  it('does not send duplicate pipeline calls while a generation request is pending', async () => {
    let resolveStep: ((response: Response) => void) | undefined
    const detail = projectDetail()
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>((url) => {
      if (url === '/api/session') return Promise.resolve(json({ user }))
      if (url === '/api/projects/project-1') return Promise.resolve(json({ project: detail }))
      if (url === '/api/projects/project-1/pipeline/STYLE') return new Promise((resolve) => { resolveStep = resolve })
      return Promise.resolve(json({ error: 'Unexpected request' }, 500))
    })
    vi.stubGlobal('fetch', fetchMock)
    const ui = userEvent.setup()
    renderApp('/projects/project-1')
    const button = await screen.findByRole('button', { name: 'Generate art direction' })
    await ui.click(button)
    await ui.click(button)
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/projects/project-1/pipeline/STYLE')).toHaveLength(1)
    resolveStep?.(new Response(null, { status: 200 }))
  })

  it('uses explicit pipeline recovery while running and redirects on a generation 401', async () => {
    const running = projectDetail({ pipeline: { completedStep: null, runningStep: 'STYLE', stepState: 'RUNNING', stepStartedAt: '2026-01-01T00:00:00.000Z', stepError: null } })
    const recoveryFetch = workspaceFetch(running)
    vi.stubGlobal('fetch', recoveryFetch)
    const ui = userEvent.setup()
    renderApp('/projects/project-1')
    await ui.click(await screen.findByRole('button', { name: 'Recover interrupted generation' }))
    await waitFor(() => expect(recoveryFetch).toHaveBeenCalledWith('/api/projects/project-1/pipeline/recover', expect.any(Object)))

    cleanup()
    queryClient.clear()
    const generationFetch = workspaceFetch(projectDetail(), (url) => url.endsWith('/pipeline/STYLE') ? json({ error: 'Authentication required.' }, 401) : undefined)
    vi.stubGlobal('fetch', generationFetch)
    renderApp('/projects/project-1')
    await ui.click(await screen.findByRole('button', { name: 'Generate art direction' }))
    expect(await screen.findByRole('heading', { name: 'Bring a book to life.' })).not.toBeNull()
  })
})

function authenticatedProjectFetch() {
  return vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/session') return Promise.resolve(json({ user }))
    if (url === '/api/projects' && init?.method === 'POST') return Promise.resolve(json({ project: { id: 'project-1', title: 'A book', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', style: null, pipeline: emptyPipeline } }))
    return Promise.resolve(json({ error: 'Unexpected request' }, 500))
  })
}

function projectDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'project-1', title: 'Saved book', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', style: null,
    pipeline: emptyPipeline, geminiBook: readyBook, characters: [], chapters: [], ...overrides,
  }
}

function workspaceFetch(detail: ReturnType<typeof projectDetail>, override?: (url: string) => Response | undefined) {
  return vi.fn<(url: string, init?: RequestInit) => Promise<Response>>((url: string) => {
    const replacement = override?.(url)
    if (replacement) return Promise.resolve(replacement)
    if (url === '/api/session') return Promise.resolve(json({ user }))
    if (url === '/api/projects/project-1') return Promise.resolve(json({ project: detail }))
    if (url.includes('/gemini-book') || url.includes('/pipeline/')) return Promise.resolve(json({ status: 'completed' }))
    return Promise.resolve(json({ error: 'Unexpected request' }, 500))
  })
}
