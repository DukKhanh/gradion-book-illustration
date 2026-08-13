import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import request, { type Agent } from 'supertest'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { createApp } from '../../app.js'
import { GeminiBookController } from '../gemini-book/gemini-book.controller.js'
import { GeminiBookRepository } from '../gemini-book/gemini-book.repository.js'
import { GeminiBookService } from '../gemini-book/gemini-book.service.js'
import { PipelineRepository } from '../pipeline/pipeline.repository.js'
import {
  PipelineService,
  unsupportedPipelineExecutor,
} from '../pipeline/pipeline.service.js'
import { ProjectController } from './project.controller.js'
import { ProjectRepository } from './project.repository.js'
import { ProjectService } from './project.service.js'
import { SessionController } from '../session/session.controller.js'
import { UserRepository } from '../session/user.repository.js'
import { SessionService } from '../session/session.service.js'
import { FileStorageService } from '../../infrastructure/storage/file-storage.service.js'
import { IllustrationController } from '../pipeline/illustrations/illustration.controller.js'
import { IllustrationService } from '../pipeline/illustrations/illustration.service.js'
import { IllustrationsRepository } from '../pipeline/illustrations/illustrations.repository.js'

describe('identity and projects HTTP API', () => {
  let client: ReturnType<typeof createClient>
  let storageDirectory: string
  let app: ReturnType<typeof createApp>
  let userA: Agent
  let userB: Agent
  let geminiUploadCalls: unknown[]

  beforeEach(async () => {
    client = createClient({ url: 'file::memory:' })
    const database = drizzle(client)
    storageDirectory = await mkdtemp(join(tmpdir(), 'gradion-books-'))

    await client.execute(`
      create table users (
        id text primary key not null,
        name text not null,
        email text not null unique,
        created_at integer not null
      )
    `)
    await client.execute(`
      create table projects (
        id text primary key not null,
        user_id text not null,
        title text not null,
        book_file_path text not null,
        completed_step text,
        running_step text,
        step_state text not null default 'IDLE',
        step_started_at integer,
        step_error text,
        style text,
        gemini_book_file_uri text,
        gemini_book_state text not null default 'IDLE',
        gemini_book_started_at integer,
        gemini_book_error text,
        created_at integer not null,
        updated_at integer not null
      )
    `)
    await client.execute(`
      create table characters (
        id text primary key not null,
        project_id text not null,
        name text not null,
        prompt text not null,
        image_path text,
        generation_status text not null default 'PENDING',
        generation_error text,
        position integer not null,
        created_at integer not null,
        updated_at integer not null
      )
    `)
    await client.execute(`
      create table chapters (
        id text primary key not null,
        project_id text not null,
        name text not null,
        prompt text not null,
        character_ids_json text,
        image_path text,
        generation_status text not null default 'PENDING',
        generation_error text,
        position integer not null,
        created_at integer not null,
        updated_at integer not null
      )
    `)

    const sessionService = new SessionService(new UserRepository(database))
    const fileStorage = new FileStorageService(storageDirectory, storageDirectory)
    const projectService = new ProjectService(
      new ProjectRepository(database),
      fileStorage,
    )
    const pipelineService = new PipelineService(
      new PipelineRepository(database),
      unsupportedPipelineExecutor,
      { staleAfterMs: 60_000 },
    )
    geminiUploadCalls = []
    const geminiBookService = new GeminiBookService(
      new GeminiBookRepository(database),
      new FileStorageService(storageDirectory),
      {
        uploadBook: async (input) => {
          geminiUploadCalls.push(input)
          return { uri: 'gemini://book-1' }
        },
      },
      { apiKey: 'test-key', staleAfterMs: 60_000 },
    )
    app = createApp({
      sessionController: new SessionController(sessionService),
      projectController: new ProjectController(projectService),
      pipelineService,
      geminiBookController: new GeminiBookController(geminiBookService),
      illustrationController: new IllustrationController(
        new IllustrationService(new IllustrationsRepository(database), fileStorage),
      ),
    })
    userA = request.agent(app)
    userB = request.agent(app)
  })

  afterEach(async () => {
    client.close()
    await rm(storageDirectory, { recursive: true, force: true })
  })

  it('creates a new identity and reuses an existing normalized email', async () => {
    const first = await userA.post('/api/session').send({
      name: 'Ada Lovelace',
      email: ' Ada@Example.COM ',
    })
    const second = await userB.post('/api/session').send({
      name: 'Different Name',
      email: 'ada@example.com',
    })

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(second.body.user).toEqual({
      ...first.body.user,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    })
  })

  it('signs out and invalidates authenticated access', async () => {
    await signIn(userA, 'a@example.com')
    await userA.delete('/api/session').expect(204)
    await userA.get('/api/projects').expect(401)
  })

  it('creates a project from pasted book text', async () => {
    await signIn(userA, 'a@example.com')

    const response = await userA.post('/api/projects').send({
      title: 'Pasted Book',
      bookText: 'Once upon a time.',
    })

    expect(response.status).toBe(201)
    expect(response.body.project).toMatchObject({
      title: 'Pasted Book',
      pipeline: {
        completedStep: null,
        runningStep: null,
        stepState: 'IDLE',
      },
    })
    expect(response.body.project).not.toHaveProperty('bookFilePath')
    const currentUser = await userA.get('/api/session')
    const storedBook = await readFile(
      join(
        storageDirectory,
        currentUser.body.user.id,
        response.body.project.id,
        'book.txt',
      ),
      'utf8',
    )
    expect(storedBook).toBe('Once upon a time.')
  })

  it('creates a project from a .txt upload', async () => {
    await signIn(userA, 'a@example.com')

    const response = await userA
      .post('/api/projects')
      .field('title', 'Uploaded Book')
      .attach('bookFile', Buffer.from('A text upload.'), 'story.txt')

    expect(response.status).toBe(201)
    expect(response.body.project.title).toBe('Uploaded Book')
  })

  it('rejects neither or both book sources', async () => {
    await signIn(userA, 'a@example.com')

    await userA.post('/api/projects').send({ title: 'No Book' }).expect(400)
    await userA.post('/api/projects').send({
      title: 'Whitespace Book',
      bookText: '   ',
    }).expect(400)
    await userA
      .post('/api/projects')
      .field('title', 'Two Books')
      .field('bookText', 'Pasted')
      .attach('bookFile', Buffer.from('Upload'), 'story.txt')
      .expect(400)
  })

  it('only lists and fetches projects owned by the session user', async () => {
    await signIn(userA, 'a@example.com')
    const created = await userA.post('/api/projects').send({
      title: 'User A Book',
      bookText: 'A book.',
    })
    const projectId = created.body.project.id as string
    await signIn(userB, 'b@example.com')

    expect((await userB.get('/api/projects')).body.projects).toEqual([])
    await userB.get(`/api/projects/${projectId}`).expect(404)
    await userA.get(`/api/projects/${projectId}`).expect(200)
  })

  it('returns owned character cards in project detail only', async () => {
    await signIn(userA, 'a@example.com')
    const created = await userA.post('/api/projects').send({
      title: 'Character Book', bookText: 'A book.',
    })
    const projectId = created.body.project.id as string
    await client.execute({
      sql: `insert into characters (
        id, project_id, name, prompt, image_path, generation_status,
        generation_error, position, created_at, updated_at
      ) values ('character-1', ?, 'Mole', 'A detailed portrait prompt.', null, 'PENDING', null, 0, 1, 1)`,
      args: [projectId],
    })
    expect((await userA.get(`/api/projects/${projectId}`)).body.project.characters)
      .toEqual([expect.objectContaining({
        id: 'character-1', name: 'Mole', position: 0,
        generationStatus: 'PENDING', portraitUrl: null,
      })])
    await signIn(userB, 'b@example.com')
    await userB.get(`/api/projects/${projectId}`).expect(404)
  })

  it('returns owned chapter cards without internal storage fields', async () => {
    await signIn(userA, 'a@example.com')
    const created = await userA.post('/api/projects').send({
      title: 'Chapter Book', bookText: 'A book.',
    })
    const projectId = created.body.project.id as string
    await client.execute({
      sql: `insert into chapters (
        id, project_id, name, prompt, character_ids_json, image_path,
        generation_status, generation_error, position, created_at, updated_at
      ) values ('chapter-1', ?, 'Opening Scene', 'An opening scene.', '[]', '/internal.png', 'PENDING', null, 0, 1, 1)`,
      args: [projectId],
    })

    const chapter = (await userA.get(`/api/projects/${projectId}`)).body.project.chapters[0]
    expect(chapter).toEqual({
      id: 'chapter-1', name: 'Opening Scene', prompt: 'An opening scene.',
      generationStatus: 'PENDING', generationError: null, position: 0,
      illustrationUrl: null,
    })
    expect(chapter).not.toHaveProperty('imagePath')
    expect(chapter).not.toHaveProperty('characterIdsJson')
  })

  it('serves only an owned durable chapter illustration', async () => {
    await signIn(userA, 'a@example.com')
    const created = await userA.post('/api/projects').send({ title: 'Illustrated', bookText: 'A book.' })
    const projectId = created.body.project.id as string
    const imagePath = join(storageDirectory, 'illustration.png')
    await writeFile(imagePath, new Uint8Array([137, 80, 78, 71]))
    await client.execute({
      sql: `insert into chapters (
        id, project_id, name, prompt, character_ids_json, image_path,
        generation_status, generation_error, position, created_at, updated_at
      ) values ('chapter-image', ?, 'Opening', 'Prompt', '[]', ?, 'DONE', null, 0, 1, 1)`,
      args: [projectId, imagePath],
    })
    expect((await userA.get(`/api/projects/${projectId}`)).body.project.chapters[0].illustrationUrl)
      .toBe(`/api/projects/${projectId}/chapters/chapter-image/illustration`)
    await userA.get(`/api/projects/${projectId}/chapters/chapter-image/illustration`)
      .expect('Content-Type', /image\/jpeg/).expect(200)
    await signIn(userB, 'b@example.com')
    await userB.get(`/api/projects/${projectId}/chapters/chapter-image/illustration`).expect(404)
  })

  it('requires a session and prevents other users from mutating pipeline state', async () => {
    await request(app)
      .post('/api/projects/project-1/pipeline/STYLE')
      .expect(401)

    await signIn(userA, 'a@example.com')
    const created = await userA.post('/api/projects').send({
      title: 'Pipeline Book',
      bookText: 'A book.',
    })
    await signIn(userB, 'b@example.com')

    await userB
      .post(`/api/projects/${created.body.project.id}/pipeline/STYLE`)
      .expect(404)
    await userB
      .post(`/api/projects/${created.body.project.id}/pipeline/CHARACTERS`)
      .expect(404)
    await userB
      .post(`/api/projects/${created.body.project.id}/pipeline/recover`)
      .expect(404)
  })

  it('does not let another user initialize a Gemini book reference', async () => {
    await signIn(userA, 'a@example.com')
    const created = await userA.post('/api/projects').send({
      title: 'Gemini Book',
      bookText: 'A book.',
    })
    await signIn(userB, 'b@example.com')

    await userB
      .post(`/api/projects/${created.body.project.id}/gemini-book`)
      .expect(404)
    expect(geminiUploadCalls).toEqual([])
  })
  it('serves the full source book only to the authenticated project owner', async () => {
    await signIn(userA, 'a@example.com')
    const created = await userA.post('/api/projects').send({
      title: 'Readable Book',
      bookText: 'Chapter One\n\nThe complete source manuscript.',
    })
    const projectId = created.body.project.id as string

    const response = await userA.get(`/api/projects/${projectId}/book`)
    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      bookText: 'Chapter One\n\nThe complete source manuscript.',
    })
    expect(response.body).not.toHaveProperty('bookFilePath')
  })

  it('requires authentication to read source book text', async () => {
    await request(app).get('/api/projects/project-1/book').expect(401)
  })

  it('does not expose source book text to another user', async () => {
    await signIn(userA, 'a@example.com')
    const created = await userA.post('/api/projects').send({
      title: 'Private Book',
      bookText: 'Private manuscript.',
    })
    const projectId = created.body.project.id as string

    await signIn(userB, 'b@example.com')
    await userB.get(`/api/projects/${projectId}/book`).expect(404)
  })

})

async function signIn(agent: Agent, email: string): Promise<void> {
  await agent.post('/api/session').send({
    name: 'Test User',
    email,
  }).expect(200)
}
