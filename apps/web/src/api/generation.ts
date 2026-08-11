import { apiRequest } from './client'
import type { PipelineStep } from './types'

export function initializeGeminiBook(projectId: string): Promise<void> {
  return apiRequest<void>(`/projects/${projectId}/gemini-book`, { method: 'POST' })
}

export function recoverGeminiBook(projectId: string): Promise<void> {
  return apiRequest<void>(`/projects/${projectId}/gemini-book/recover`, { method: 'POST' })
}

export function recoverPipeline(projectId: string): Promise<void> {
  return apiRequest<void>(`/projects/${projectId}/pipeline/recover`, { method: 'POST' })
}

export function runPipelineStep(
  projectId: string,
  step: PipelineStep,
  style?: string,
): Promise<void> {
  const body = style === undefined ? undefined : JSON.stringify({ style })
  return apiRequest<void>(`/projects/${projectId}/pipeline/${step}`, {
    method: 'POST',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body } : {}),
  })
}
