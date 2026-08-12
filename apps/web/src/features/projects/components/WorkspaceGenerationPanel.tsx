import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  initializeGeminiBook,
  recoverGeminiBook,
  recoverPipeline,
  runPipelineStep,
} from '../api/generation.api'
import type { ProjectDetailDto, PipelineStep } from '../../../api/types'
import { nextPipelineStep, retryPipelineStep } from '../utils/generation'

const PORTRAIT_POLL_INTERVAL_MS = 1_500

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

type StyleIntent =
  | { kind: 'manual'; style: string }
  | { kind: 'ai' }

export function WorkspaceGenerationPanel({ project }: { project: ProjectDetailDto }) {
  const queryClient = useQueryClient()
  const [style, setStyle] = useState('')
  const [styleIntent, setStyleIntent] = useState<StyleIntent | null>(null)
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
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects', project.id] })
    },
  })
  const portraitGenerationPending =
    action.isPending &&
    action.variables?.kind === 'run-step' &&
    action.variables.step === 'PORTRAITS'

  useEffect(() => {
    if (!portraitGenerationPending) return

    let disposed = false

    const refreshProject = async () => {
      if (disposed) return
      await queryClient.refetchQueries({
        queryKey: ['projects', project.id],
        type: 'active',
      })
    }

    void refreshProject()

    const interval = window.setInterval(() => {
      void refreshProject()
    }, PORTRAIT_POLL_INTERVAL_MS)

    return () => {
      disposed = true
      window.clearInterval(interval)
    }
  }, [portraitGenerationPending, project.id, queryClient])

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
    if (retry === 'STYLE') {
      return <GenerationPanel title="Art direction failed">
        <p role="alert">{project.pipeline.stepError ?? 'This step failed and can be retried.'}</p>
        {styleIntent?.kind === 'manual' ? <>
          <p>Retrying will reuse your manual art direction.</p>
          <button className="primary-button" type="button" disabled={isPending} onClick={() => action.mutate({ kind: 'run-step', step: 'STYLE', style: styleIntent.style })}>
            {isPending ? 'Retrying art direction…' : 'Retry art direction'}
          </button>
        </> : styleIntent?.kind === 'ai' ? <>
          <p>Retrying will use AI-generated art direction.</p>
          <button className="primary-button" type="button" disabled={isPending} onClick={() => action.mutate({ kind: 'run-step', step: 'STYLE' })}>
            {isPending ? 'Retrying art direction…' : 'Retry art direction'}
          </button>
        </> : <>
          <p>Choose a manual art direction, or explicitly retry with AI.</p>
          <label className="style-field" htmlFor="retry-manual-style">Art direction (optional)<input id="retry-manual-style" value={style} onChange={(event) => setStyle(event.target.value)} placeholder="Enter a manual art direction" /></label>
          <button className="primary-button" type="button" disabled={isPending || style.trim().length === 0} onClick={() => {
            const manualStyle = style.trim()
            setStyleIntent({ kind: 'manual', style: manualStyle })
            action.mutate({ kind: 'run-step', step: 'STYLE', style: manualStyle })
          }}>
            {isPending ? 'Retrying art direction…' : 'Retry manual art direction'}
          </button>
          <button className="secondary-button" type="button" disabled={isPending} onClick={() => {
            setStyleIntent({ kind: 'ai' })
            action.mutate({ kind: 'run-step', step: 'STYLE' })
          }}>
            {isPending ? 'Retrying art direction…' : 'Retry with AI'}
          </button>
        </>}
        <ActionError error={error} />
      </GenerationPanel>
    }
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
      if (next === 'STYLE') setStyleIntent(manualStyle ? { kind: 'manual', style: manualStyle } : { kind: 'ai' })
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
