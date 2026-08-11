import { describe, expect, it } from 'vitest'

import { pipelineStepPresentation, projectProgress } from './progress'

const base = { runningStep: null, stepState: 'IDLE' as const, stepStartedAt: null, stepError: null }

describe('projectProgress', () => {
  it('counts only completedStep', () => {
    expect(projectProgress({ ...base, completedStep: null })).toEqual({ completed: 0, status: 'Draft' })
    expect(projectProgress({ ...base, completedStep: 'STYLE' })).toEqual({ completed: 1, status: 'In progress' })
    expect(projectProgress({ ...base, completedStep: 'CHARACTERS' })).toEqual({ completed: 2, status: 'In progress' })
    expect(projectProgress({ ...base, completedStep: 'ILLUSTRATIONS' })).toEqual({ completed: 5, status: 'Done' })
  })

  it('does not count a RUNNING or FAILED current step', () => {
    expect(projectProgress({ ...base, completedStep: 'STYLE', runningStep: 'CHARACTERS', stepState: 'RUNNING' })).toEqual({ completed: 1, status: 'In progress' })
    expect(projectProgress({ ...base, completedStep: 'STYLE', runningStep: 'CHARACTERS', stepState: 'FAILED' })).toEqual({ completed: 1, status: 'In progress' })
  })

  it('derives named step states from persisted pipeline fields only', () => {
    expect(pipelineStepPresentation({ completedStep: 'CHARACTERS', runningStep: 'PORTRAITS', stepState: 'FAILED', stepStartedAt: null, stepError: 'failed' }))
      .toEqual([
        { step: 'STYLE', state: 'completed' },
        { step: 'CHARACTERS', state: 'completed' },
        { step: 'PORTRAITS', state: 'failed' },
        { step: 'CHAPTERS', state: 'upcoming' },
        { step: 'ILLUSTRATIONS', state: 'upcoming' },
      ])
  })
})
