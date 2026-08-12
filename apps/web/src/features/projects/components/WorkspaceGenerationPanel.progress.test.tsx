import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { runPipelineStep } from '../api/generation.api'
import type { ProjectDetailDto } from '../../../api/types'
import { WorkspaceGenerationPanel } from './WorkspaceGenerationPanel'

vi.mock('../api/generation.api', () => ({
  initializeGeminiBook: vi.fn(),
  recoverGeminiBook: vi.fn(),
  recoverPipeline: vi.fn(),
  runPipelineStep: vi.fn(),
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

const project: ProjectDetailDto = {
  id: 'project-1',
  title: 'Book',
  createdAt: '2026-08-11T00:00:00.000Z',
  updatedAt: '2026-08-11T00:00:00.000Z',
  style: 'Watercolor',
  geminiBook: { state: 'READY', startedAt: null, error: null },
  pipeline: {
    completedStep: 'CHARACTERS',
    runningStep: null,
    stepState: 'IDLE',
    stepStartedAt: null,
    stepError: null,
  },
  characters: [],
  chapters: [],
}

describe('WorkspaceGenerationPanel portrait progress', () => {
  it('starts focused detail polling while an explicit PORTRAITS request is pending', async () => {
    let finishPortraits: (() => void) | undefined
    vi.mocked(runPipelineStep).mockImplementation(
      () => new Promise<void>((resolve) => { finishPortraits = resolve }),
    )

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const refetch = vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue(undefined)
    const setIntervalSpy = vi.spyOn(window, 'setInterval')
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')

    render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceGenerationPanel project={project} />
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Generate portraits' }))

    await waitFor(() => {
      expect(runPipelineStep).toHaveBeenCalledWith('project-1', 'PORTRAITS', undefined)
    })
    await waitFor(() => {
      expect(refetch).toHaveBeenCalledWith({
        queryKey: ['projects', 'project-1'],
        type: 'active',
      })
    })
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1_500)

    finishPortraits?.()
    await waitFor(() => expect(clearIntervalSpy).toHaveBeenCalled())
  })

  it('does not start portrait polling for STYLE', async () => {
    const styleProject: ProjectDetailDto = {
      ...project,
      style: null,
      pipeline: {
        completedStep: null,
        runningStep: null,
        stepState: 'IDLE',
        stepStartedAt: null,
        stepError: null,
      },
    }
    let finishStyle: (() => void) | undefined
    vi.mocked(runPipelineStep).mockImplementation(
      () => new Promise<void>((resolve) => { finishStyle = resolve }),
    )

    const queryClient = new QueryClient()
    const refetch = vi.spyOn(queryClient, 'refetchQueries')

    render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceGenerationPanel project={styleProject} />
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Generate art direction' }))
    await waitFor(() => {
      expect(runPipelineStep).toHaveBeenCalledWith('project-1', 'STYLE', undefined)
    })
    expect(refetch).not.toHaveBeenCalled()
    finishStyle?.()
  })
})
