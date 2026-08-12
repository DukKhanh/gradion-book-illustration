import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { createProject } from '../api/projects.api'

export function CreateProjectPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [source, setSource] = useState<'text' | 'file'>('text')
  const [bookText, setBookText] = useState('')
  const [bookFile, setBookFile] = useState<File | undefined>()
  const create = useMutation({
    mutationFn: createProject,
    onSuccess: (project) => { queryClient.invalidateQueries({ queryKey: ['projects'] }); navigate(`/projects/${project.id}`) },
  })
  function chooseSource(next: 'text' | 'file') { setSource(next); if (next === 'text') setBookFile(undefined); else setBookText('') }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); create.mutate({ title: title.trim(), ...(source === 'text' ? { bookText } : { bookFile }) }) }
  return <main className="page create-page"><Link className="back-link" to="/projects">← Projects</Link><section className="create-card">
    <p className="eyebrow">NEW PROJECT</p><h1>Add a book</h1><p className="lede">Choose one source for the book you want to illustrate.</p>
    <form onSubmit={submit} aria-describedby={create.isError ? 'create-error' : undefined}>
      <label htmlFor="project-title">Project title</label><input id="project-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
      <fieldset><legend>Book source</legend><div className="source-toggle"><button type="button" className={source === 'text' ? 'selected' : ''} onClick={() => chooseSource('text')}>Paste text</button><button type="button" className={source === 'file' ? 'selected' : ''} onClick={() => chooseSource('file')}>Upload .txt</button></div></fieldset>
      {source === 'text' ? <><label htmlFor="book-text">Book text</label><textarea id="book-text" value={bookText} onChange={(event) => setBookText(event.target.value)} required /></> : <><label htmlFor="book-file">Text file</label><input id="book-file" type="file" accept=".txt,text/plain" onChange={(event) => setBookFile(event.target.files?.[0])} required /><p className="field-hint">Upload one UTF-8 .txt file.</p></>}
      {create.isError && <p id="create-error" className="form-error" role="alert">{create.error.message}</p>}
      <button className="primary-button" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create project'}</button>
    </form>
  </section></main>
}
