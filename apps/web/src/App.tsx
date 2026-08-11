import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import './App.css'
import { HttpError } from './api/client'
import { createProject, getProject, listProjects } from './api/projects'
import type { ProjectDetailDto, ProjectDto } from './api/types'
import { useSession } from './features/session/SessionProvider'
import { projectProgress } from './features/projects/progress'

function Bootstrap() {
  return <main className="bootstrap">Checking your session…</main>
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, isPending } = useSession()
  if (isPending) return <Bootstrap />
  return user ? <Navigate to="/projects" replace /> : <>{children}</>
}

function Protected() {
  const { user, isPending } = useSession()
  if (isPending) return <Bootstrap />
  return user ? <Shell /> : <Navigate to="/" replace />
}

function Shell() {
  const { user, signOut } = useSession()
  return (
    <>
      <header className="site-header">
        <Link className="brand" to="/projects">Gradion<span>✦</span></Link>
        <nav aria-label="Primary navigation"><Link to="/projects">Projects</Link></nav>
        <div className="identity">
          <span className="avatar" aria-hidden="true">{user?.name.slice(0, 1).toUpperCase()}</span>
          <span>{user?.name}</span>
          <button className="link-button" type="button" disabled={signOut.isPending} onClick={() => signOut.mutate()}>
            {signOut.isPending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>
      <Outlet />
    </>
  )
}

function Identity() {
  const { identify } = useSession()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    identify.mutate({ name: name.trim(), email: email.trim() })
  }

  return <main className="welcome-page"><section className="identity-card">
    <p className="eyebrow">GRADION BOOK ILLUSTRATION STUDIO</p>
    <h1>Bring a book to life.</h1>
    <p className="lede">Start a private project, then guide its illustrated story through the studio.</p>
    <form onSubmit={submit} aria-describedby={identify.isError ? 'identity-error' : undefined}>
      <label htmlFor="identity-name">Your name</label>
      <input id="identity-name" value={name} onChange={(event) => setName(event.target.value)} required />
      <label htmlFor="identity-email">Email address</label>
      <input id="identity-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      {identify.isError && <p id="identity-error" className="form-error" role="alert">{identify.error.message}</p>}
      <button className="primary-button" disabled={identify.isPending}>{identify.isPending ? 'Entering studio…' : 'Enter studio'}</button>
    </form>
  </section></main>
}

function Projects() {
  const projects = useQuery({ queryKey: ['projects'], queryFn: listProjects })
  if (projects.isPending) return <main className="page"><p>Loading projects…</p></main>
  if (projects.isError) return <main className="page"><ErrorMessage error={projects.error} onRetry={() => projects.refetch()} /></main>
  return <main className="page library-page">
    <div className="page-heading"><div><p className="eyebrow">YOUR LIBRARY</p><h1>Your projects</h1></div><Link className="primary-button" to="/projects/new">New project</Link></div>
    {projects.data.length === 0 ? <section className="empty-state"><h2>Your library is waiting.</h2><p>Create a project from a pasted manuscript or a .txt file.</p><Link className="primary-button" to="/projects/new">Create project</Link></section> : <section className="project-list" aria-label="Projects">{projects.data.map((project) => <ProjectCard key={project.id} project={project} />)}</section>}
  </main>
}

function ProjectCard({ project }: { project: ProjectDto }) {
  const progress = projectProgress(project.pipeline)
  return <Link className="project-card" to={`/projects/${project.id}`}>
    <div><h2>{project.title}</h2><p>Updated {new Date(project.updatedAt).toLocaleDateString()}</p></div>
    <PipelineProgress project={project} />
    <span className={`status ${progress.status.toLowerCase().replace(' ', '-')}`}>{progress.status}</span>
  </Link>
}

function PipelineProgress({ project }: { project: Pick<ProjectDto, 'pipeline'> }) {
  const progress = projectProgress(project.pipeline)
  return <div className="pipeline-progress" aria-label={`${progress.completed} of 5 steps complete`}>
    <div className="segments" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <span key={index} className={index < progress.completed ? 'complete' : ''} />)}</div>
    <span>{progress.completed} / 5</span>
  </div>
}

function CreateProject() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [source, setSource] = useState<'text' | 'file'>('text')
  const [bookText, setBookText] = useState('')
  const [bookFile, setBookFile] = useState<File | undefined>()
  const create = useMutation({
    mutationFn: createProject,
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      navigate(`/projects/${project.id}`)
    },
  })
  function chooseSource(next: 'text' | 'file') {
    setSource(next)
    if (next === 'text') setBookFile(undefined)
    else setBookText('')
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    create.mutate({ title: title.trim(), ...(source === 'text' ? { bookText } : { bookFile }) })
  }
  return <main className="page create-page"><Link className="back-link" to="/projects">← Projects</Link><section className="create-card">
    <p className="eyebrow">NEW PROJECT</p><h1>Add a book</h1><p className="lede">Choose one source for the book you want to illustrate.</p>
    <form onSubmit={submit} aria-describedby={create.isError ? 'create-error' : undefined}>
      <label htmlFor="project-title">Project title</label><input id="project-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
      <fieldset><legend>Book source</legend><div className="source-toggle">
        <button type="button" className={source === 'text' ? 'selected' : ''} onClick={() => chooseSource('text')}>Paste text</button>
        <button type="button" className={source === 'file' ? 'selected' : ''} onClick={() => chooseSource('file')}>Upload .txt</button>
      </div></fieldset>
      {source === 'text' ? <><label htmlFor="book-text">Book text</label><textarea id="book-text" value={bookText} onChange={(event) => setBookText(event.target.value)} required /></> : <><label htmlFor="book-file">Text file</label><input id="book-file" type="file" accept=".txt,text/plain" onChange={(event) => setBookFile(event.target.files?.[0])} required /><p className="field-hint">Upload one UTF-8 .txt file.</p></>}
      {create.isError && <p id="create-error" className="form-error" role="alert">{create.error.message}</p>}
      <button className="primary-button" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create project'}</button>
    </form>
  </section></main>
}

function Workspace() {
  const { projectId } = useParams()
  const project = useQuery({ queryKey: ['projects', projectId], queryFn: () => getProject(projectId ?? ''), enabled: Boolean(projectId) })
  if (project.isPending) return <main className="page"><p>Loading project…</p></main>
  if (project.isError) return <main className="page"><ErrorMessage error={project.error} /></main>
  return <WorkspaceContent project={project.data} />
}

function WorkspaceContent({ project }: { project: ProjectDetailDto }) {
  return <main className="page workspace"><Link className="back-link" to="/projects">← Projects</Link><div className="workspace-heading"><div><p className="eyebrow">PROJECT WORKSPACE</p><h1>{project.title}</h1></div><PipelineProgress project={project} /></div>
    <section className="workspace-status"><span className="status">{projectProgress(project.pipeline).status}</span><p>{project.pipeline.stepError ?? 'Your saved project state appears here. Generation controls arrive in the next phase.'}</p></section>
    <div className="workspace-grid"><section className="workspace-main">
      <ArtifactSection title="Art direction">{project.style ? <p>{project.style}</p> : <EmptyArtifact text="No art direction has been generated yet." />}</ArtifactSection>
      <ArtifactSection title="Characters">{project.characters.length ? <div className="character-grid">{project.characters.map((character) => <article className="character-card" key={character.id}>{character.portraitUrl ? <img src={character.portraitUrl} alt={`Portrait of ${character.name}`} /> : <div className="image-placeholder">Portrait pending</div>}<h3>{character.name}</h3><p>{character.prompt}</p></article>)}</div> : <EmptyArtifact text="Characters will appear here when they are available." />}</ArtifactSection>
      <ArtifactSection title="Chapter">{project.chapters.length ? project.chapters.map((chapter) => <article className="chapter-card" key={chapter.id}>{chapter.illustrationUrl ? <img src={chapter.illustrationUrl} alt={`Illustration for ${chapter.name}`} /> : <div className="illustration-placeholder">Illustration pending</div>}<div><h3>{chapter.name}</h3><p>{chapter.prompt}</p></div></article>) : <EmptyArtifact text="Your chapter will appear here when it is available." />}</ArtifactSection>
    </section><aside className="workspace-aside"><h2>Progress</h2><PipelineProgress project={project} /><p>Results shown here are loaded from the saved project.</p></aside></div>
  </main>
}

function ArtifactSection({ title, children }: { title: string; children: ReactNode }) { return <section className="artifact-section"><h2>{title}</h2>{children}</section> }
function EmptyArtifact({ text }: { text: string }) { return <p className="empty-artifact">{text}</p> }
function ErrorMessage({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const message = error instanceof HttpError && error.status === 404 ? 'This project could not be found.' : error.message
  return <section className="error-state" role="alert"><h1>Unable to load this page</h1><p>{message}</p>{onRetry && <button className="primary-button" onClick={onRetry}>Try again</button>}</section>
}

export default function App() {
  return <Routes>
    <Route path="/" element={<PublicOnly><Identity /></PublicOnly>} />
    <Route element={<Protected />}><Route path="/projects" element={<Projects />} /><Route path="/projects/new" element={<CreateProject />} /><Route path="/projects/:projectId" element={<Workspace />} /></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
