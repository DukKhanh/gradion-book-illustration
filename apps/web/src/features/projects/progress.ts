import type { PipelineDto, PipelineStep } from '../../api/types'

export const PIPELINE_STEPS: PipelineStep[] = [
  'STYLE', 'CHARACTERS', 'PORTRAITS', 'CHAPTERS', 'ILLUSTRATIONS',
]

export function projectProgress(pipeline: PipelineDto): { completed: number, status: 'Draft' | 'In progress' | 'Done' } {
  const completed = pipeline.completedStep === null ? 0 : PIPELINE_STEPS.indexOf(pipeline.completedStep) + 1
  if (completed === PIPELINE_STEPS.length) return { completed, status: 'Done' }
  if (completed === 0 && pipeline.runningStep === null && pipeline.stepState === 'IDLE') return { completed, status: 'Draft' }
  return { completed, status: 'In progress' }
}
