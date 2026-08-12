import { describe, expect, it } from 'vitest'

import type { PipelineDto } from '../../../api/types'
import { nextPipelineStep, retryPipelineStep } from './generation'

function pipeline(completedStep: PipelineDto['completedStep'], stepState: PipelineDto['stepState'] = 'IDLE', runningStep: PipelineDto['runningStep'] = null): PipelineDto {
  return { completedStep, stepState, runningStep, stepStartedAt: null, stepError: null }
}

describe('generation derivation', () => {
  it.each([
    [null, 'STYLE'], ['STYLE', 'CHARACTERS'], ['CHARACTERS', 'PORTRAITS'],
    ['PORTRAITS', 'CHAPTERS'], ['CHAPTERS', 'ILLUSTRATIONS'], ['ILLUSTRATIONS', null],
  ] as const)('derives %s as the completed step before %s', (completed, next) => {
    expect(nextPipelineStep(pipeline(completed))).toBe(next)
  })

  it('suppresses normal next actions while failed or running and retries only the failed step', () => {
    expect(nextPipelineStep(pipeline('CHARACTERS', 'FAILED', 'PORTRAITS'))).toBeNull()
    expect(retryPipelineStep(pipeline('CHARACTERS', 'FAILED', 'PORTRAITS'))).toBe('PORTRAITS')
    expect(nextPipelineStep(pipeline('CHARACTERS', 'RUNNING', 'PORTRAITS'))).toBeNull()
    expect(retryPipelineStep(pipeline('CHARACTERS', 'RUNNING', 'PORTRAITS'))).toBeNull()
  })
})
