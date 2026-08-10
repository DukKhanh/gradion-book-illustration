import { PIPELINE_STEPS } from './pipeline.constants.js'
import type { PipelineExecutor } from './pipeline.service.js'

export class PipelineStepExecutor implements PipelineExecutor {
  constructor(
    private readonly style: PipelineExecutor,
    private readonly characters: PipelineExecutor,
    private readonly portraits: PipelineExecutor,
  ) {}

  async execute(input: Parameters<PipelineExecutor['execute']>[0]): Promise<void> {
    if (input.step === PIPELINE_STEPS.STYLE) {
      return this.style.execute(input)
    }
    if (input.step === PIPELINE_STEPS.CHARACTERS) {
      return this.characters.execute(input)
    }
    if (input.step === PIPELINE_STEPS.PORTRAITS) {
      return this.portraits.execute(input)
    }
    throw new Error('This pipeline step is not implemented.')
  }
}
