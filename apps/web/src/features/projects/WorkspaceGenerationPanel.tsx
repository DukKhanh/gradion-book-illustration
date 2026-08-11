import { useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  initializeGeminiBook,
  recoverGeminiBook,
  recoverPipeline,
  runPipelineStep,
} from '../../api/generation'
import type { ProjectDetailDto, PipelineStep } from '../../api/types'
import { nextPipelineStep, retryPipelineStep } from './generation'

const stepLabels: Record<PipelineStep, string> = {
  STYLE: 'art direction',
  CHARACTERS: 'characters',
  PORTRAITS: 'portraits',
  CHAPTERS: 'chapter',
  ILLUSTRATIONS: 'illustration',
}

type Action =
  | { kind: 'initialize-book' }
  | { kind: 'recover-book' }
  | { kind: 'recover-pipeline' }
  | { kind: 'run-step'; step: PipelineStep; style?: string }

export function WorkspaceGenerationPanel({ project }: { project: ProjectDetailDto }) {
  const queryClient = useQueryClient()
  const [style, setStyle] = useState('')
  const action = useMutation({
    mutationFn: async (input: Action) => {
      if (input.kind === 'initialize-book') return initializeGeminiBook(project.id)
      if (input.kind === 'recover-book') return recoverGeminiBook(project.id)
      if (input.kind === 'recover-pipeline') return recoverPipeline(project.id)
      return runPipelineStep(project.id, input.step, input.style)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projects', project.id] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ])
    },
  })
  const error = action.isError ? action.error.message : null
  const isPending = action.isPending

  if (project.geminiBook.state !== 'READY') {
    if (project.geminiBook.state === 'RUNNING') {
      return <GenerationPanel title="Preparing your book">
        <p role="status">Gemini book preparation is running. Generation remains unavailable until it is ready.</p>
        <button className="secondary-button" type="button" disabled={isPending} onClick={() => action.mutate({ kind: 'recover-book' })}>
          {isPending ? 'Recovering…' : 'Recover interrupted preparation'}
        </button>
        <ActionError error={error} />
      </GenerationPanel>
    }
    return <GenerationPanel title="Prepare your book">
      <p>{project.geminiBook.state === 'FAILED' ? project.geminiBook.error : 'Prepare a reusable book reference before generating art direction.'}</p>
      <button className="primary-button" type="button" disabled={isPending} onClick={() => action.mutate({ kind: 'initialize-book' })}>
        {isPending ? 'Preparing book…' : 'Prepare book for generation'}
      </button>
      <ActionError error={error} />
    </GenerationPanel>
  }

  if (project.pipeline.stepState === 'RUNNING') {
    return <GenerationPanel title="Generation in progress">
      <p role="status">Generating {label(project.pipeline.runningStep)}. No other generation action is available while this step is running.</p>
      <button className="secondary-button" type="button" disabled={isPending} onClick={() => action.mutate({ kind: 'recover-pipeline' })}>
        {isPending ? 'Recovering…' : 'Recover interrupted generation'}
      </button>
      <ActionError error={error} />
    </GenerationPanel>
  }

  const retry = retryPipelineStep(project.pipeline)
  if (retry) {
    return <GenerationPanel title={`${label(retry)} failed`}>
      <p role="alert">{project.pipeline.stepError ?? 'This step failed and can be retried.'}</p>
      <button className="primary-button" type="button" disabled={isPending} onClick={() => action.mutate({ kind: 'run-step', step: retry })}>
        {isPending ? `Retrying ${label(retry)}…` : `Retry ${label(retry)}`}
      </button>
      <ActionError error={error} />
    </GenerationPanel>
  }

  const next = nextPipelineStep(project.pipeline)
  if (!next) {
    return <GenerationPanel title="Project complete"><p>All five generation steps are complete. Reopening this project never regenerates saved work.</p></GenerationPanel>
  }

  return <GenerationPanel title={`Ready for ${label(next)}`}>
    <p>{next === 'STYLE' ? 'Choose an optional art direction, or leave it blank to let Gemini create one from your prepared book.' : `Generate ${label(next)} from your saved project state.`}</p>
    {next === 'STYLE' && <label className="style-field" htmlFor="manual-style">Art direction (optional)<input id="manual-style" value={style} onChange={(event) => setStyle(event.target.value)} placeholder="Leave blank for AI-generated art direction" /></label>}
    <button className="primary-button" type="button" disabled={isPending} onClick={() => {
      const manualStyle = next === 'STYLE' ? style.trim() : undefined
      action.mutate({ kind: 'run-step', step: next, ...(manualStyle ? { style: manualStyle } : {}) })
    }}>
      {isPending ? `Generating ${label(next)}…` : `Generate ${label(next)}`}
    </button>
    <ActionError error={error} />
  </GenerationPanel>
}

function label(step: PipelineStep | null): string {
  return step ? stepLabels[step] : 'the current step'
}

function GenerationPanel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="generation-panel"><h2>{title}</h2>{children}</section>
}

function ActionError({ error }: { error: string | null }) {
  return error ? <p className="form-error" role="alert">{error}</p> : null
}
