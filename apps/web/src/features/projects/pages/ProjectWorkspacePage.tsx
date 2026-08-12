import { type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import type { ProjectDetailDto } from '../../../api/types'
import { ErrorState } from '../../../shared/components/ErrorState'
import { getProject } from '../api/projects.api'
import { BookTextDisclosure } from '../components/BookTextDisclosure'
import { ChapterCard } from '../components/ChapterCard'
import { CharacterCard } from '../components/CharacterCard'
import { PipelineProgress } from '../components/PipelineProgress'
import { WorkspaceGenerationPanel } from '../components/WorkspaceGenerationPanel'
import { WorkspacePipelineStepper } from '../components/WorkspacePipelineStepper'
import { projectProgress } from '../utils/progress'

export function ProjectWorkspacePage() {
  const { projectId } = useParams()
  const project = useQuery({ queryKey: ['projects', projectId], queryFn: () => getProject(projectId ?? ''), enabled: Boolean(projectId) })
  if (project.isPending) return <main className="page"><p>Loading project…</p></main>
  if (project.isError) return <main className="page"><ErrorState error={project.error} /></main>
  return <WorkspaceContent project={project.data} />
}

function WorkspaceContent({ project }: { project: ProjectDetailDto }) {
  const progress = projectProgress(project.pipeline)
  return <main className="page workspace">
    <Link className="back-link" to="/projects">← Projects</Link>
    <div className="workspace-heading"><div><p className="eyebrow">PROJECT WORKSPACE</p><h1>{project.title}</h1><p className="workspace-created">Created {new Date(project.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p></div><PipelineProgress project={project} /></div>
    <section className="workspace-status"><span className={`status ${progress.status.toLowerCase().replace(' ', '-')}`}>{progress.status}</span><p>{project.pipeline.stepError ?? 'Your saved project state is shown below.'}</p></section>
    <WorkspacePipelineStepper pipeline={project.pipeline} />
    <WorkspaceGenerationPanel project={project} />
    <section className="workspace-main">
      <ArtifactSection title="Art direction">{project.style ? <p className="art-direction-copy">{project.style}</p> : <EmptyArtifact text="No art direction has been generated yet." />}</ArtifactSection>
      <ArtifactSection title="Book text"><BookTextDisclosure projectId={project.id} /></ArtifactSection>
      <ArtifactSection title="Characters">{project.characters.length ? <div className="character-grid">{project.characters.map((character) => <CharacterCard key={character.id} character={character} />)}</div> : <EmptyArtifact text="Characters will appear here when they are available." />}</ArtifactSection>
      <ArtifactSection title="Chapter">{project.chapters.length ? project.chapters.map((chapter) => <ChapterCard key={chapter.id} chapter={chapter} />) : <EmptyArtifact text="Your chapter will appear here when it is available." />}</ArtifactSection>
    </section>
  </main>
}

function ArtifactSection({ title, children }: { title: string; children: ReactNode }) { return <section className="artifact-section"><h2>{title}</h2>{children}</section> }
function EmptyArtifact({ text }: { text: string }) { return <p className="empty-artifact">{text}</p> }
