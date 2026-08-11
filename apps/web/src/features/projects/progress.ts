import type { PipelineDto, PipelineStep } from '../../api/types'

export const PIPELINE_STEPS: PipelineStep[] = [
  'STYLE', 'CHARACTERS', 'PORTRAITS', 'CHAPTERS', 'ILLUSTRATIONS',
]

export type PipelineStepPresentation = {
  step: PipelineStep
  state: 'completed' | 'current' | 'running' | 'failed' | 'upcoming'
}

export function projectProgress(pipeline: PipelineDto): { completed: number, status: 'Draft' | 'In progress' | 'Done' } {
  const completed = pipeline.completedStep === null ? 0 : PIPELINE_STEPS.indexOf(pipeline.completedStep) + 1
  if (completed === PIPELINE_STEPS.length) return { completed, status: 'Done' }
  if (completed === 0 && pipeline.runningStep === null && pipeline.stepState === 'IDLE') return { completed, status: 'Draft' }
  return { completed, status: 'In progress' }
}

export function pipelineStepPresentation(
  pipeline: PipelineDto,
): PipelineStepPresentation[] {
  const completedIndex = pipeline.completedStep === null
    ? -1
    : PIPELINE_STEPS.indexOf(pipeline.completedStep)
  const activeStep = pipeline.runningStep ?? PIPELINE_STEPS[completedIndex + 1] ?? null

  return PIPELINE_STEPS.map((step, index) => {
    if (index <= completedIndex) return { step, state: 'completed' }
    if (step !== activeStep) return { step, state: 'upcoming' }
    if (pipeline.stepState === 'RUNNING') return { step, state: 'running' }
    if (pipeline.stepState === 'FAILED') return { step, state: 'failed' }
    return { step, state: 'current' }
  })
}
