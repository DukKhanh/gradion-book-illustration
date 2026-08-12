import type { PipelineDto, PipelineStep } from '../../../api/types'
import { pipelineStepPresentation } from '../utils/progress'

const labels: Record<PipelineStep, string> = {
  STYLE: 'Style',
  CHARACTERS: 'Characters',
  PORTRAITS: 'Portraits',
  CHAPTERS: 'Chapter',
  ILLUSTRATIONS: 'Illustration',
}

export function WorkspacePipelineStepper({ pipeline }: { pipeline: PipelineDto }) {
  const steps = pipelineStepPresentation(pipeline)

  return <ol className="workspace-stepper" aria-label="Generation progress">
    {steps.map(({ step, state }) => (
      <li className={`stepper-step ${state}`} key={step} aria-current={state === 'current' || state === 'running' || state === 'failed' ? 'step' : undefined}>
        <span className="stepper-marker" aria-hidden="true">{state === 'completed' ? '✓' : ''}</span>
        <span className="stepper-label">{labels[step]}</span>
      </li>
    ))}
  </ol>
}
