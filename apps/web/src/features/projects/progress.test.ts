import { describe, expect, it } from 'vitest'

import { projectProgress } from './progress'

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
})
