import type { PipelineDto, PipelineStep } from '../../../api/types'
import { PIPELINE_STEPS } from './progress'

export function nextPipelineStep(pipeline: PipelineDto): PipelineStep | null {
  if (pipeline.stepState !== 'IDLE') return null
  const completedIndex = pipeline.completedStep === null
    ? -1
    : PIPELINE_STEPS.indexOf(pipeline.completedStep)
  return PIPELINE_STEPS[completedIndex + 1] ?? null
}

export function retryPipelineStep(pipeline: PipelineDto): PipelineStep | null {
  return pipeline.stepState === 'FAILED' ? pipeline.runningStep : null
}
