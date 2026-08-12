import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { listProjects } from '../api/projects.api'
import { ProjectCard } from '../components/ProjectCard'
import { EmptyState } from '../../../shared/components/EmptyState'
import { ErrorState } from '../../../shared/components/ErrorState'
import '../projects.css'

export function ProjectsPage() {
  const projects = useQuery({ queryKey: ['projects'], queryFn: listProjects })
  if (projects.isPending) return <main className="page"><p>Loading projects…</p></main>
  if (projects.isError) return <main className="page"><ErrorState error={projects.error} onRetry={() => projects.refetch()} /></main>
  return <main className="page library-page">
    <div className="page-heading"><div><p className="eyebrow">YOUR LIBRARY</p><h1>Your projects</h1></div><Link className="primary-button" to="/projects/new">New project</Link></div>
    {projects.data.length === 0 ? <EmptyState><h2>Your library is waiting.</h2><p>Create a project from a pasted manuscript or a .txt file.</p><Link className="primary-button" to="/projects/new">Create project</Link></EmptyState> : <section className="project-list" aria-label="Projects">{projects.data.map((project) => <ProjectCard key={project.id} project={project} />)}</section>}
  </main>
}
