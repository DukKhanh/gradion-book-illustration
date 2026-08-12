import { Link } from 'react-router-dom'

import type { ProjectDto } from '../../../api/types'
import { projectProgress } from '../utils/progress'
import { PipelineProgress } from './PipelineProgress'

export function ProjectCard({ project }: { project: ProjectDto }) {
  const progress = projectProgress(project.pipeline)
  return <Link className="project-card" to={`/projects/${project.id}`}>
    <div><h2>{project.title}</h2><p>Created {new Date(project.createdAt).toLocaleDateString()}</p></div>
    <PipelineProgress project={project} />
    <span className={`status ${progress.status.toLowerCase().replace(' ', '-')}`}>{progress.status}</span>
  </Link>
}
