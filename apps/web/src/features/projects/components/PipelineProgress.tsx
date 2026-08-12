import type { ProjectDto } from '../../../api/types'
import { projectProgress } from '../utils/progress'

export function PipelineProgress({ project }: { project: Pick<ProjectDto, 'pipeline'> }) {
  const progress = projectProgress(project.pipeline)
  return <div className="pipeline-progress" aria-label={`${progress.completed} of 5 steps complete`}>
    <div className="segments" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <span key={index} className={index < progress.completed ? 'complete' : ''} />)}</div>
    <span>{progress.completed} / 5</span>
  </div>
}
