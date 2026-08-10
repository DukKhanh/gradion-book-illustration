import {
  GENERATION_STATUSES,
  PIPELINE_STEPS,
  STEP_STATES,
} from './pipeline.constants.js'

export type PipelineStep =
  (typeof PIPELINE_STEPS)[keyof typeof PIPELINE_STEPS]

export type StepState =
  (typeof STEP_STATES)[keyof typeof STEP_STATES]

export type GenerationStatus =
  (typeof GENERATION_STATUSES)[keyof typeof GENERATION_STATUSES]