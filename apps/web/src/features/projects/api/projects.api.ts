import { apiRequest } from '../../../api/client'
import type { ProjectDetailDto, ProjectDto } from '../../../api/types'

export async function listProjects(): Promise<ProjectDto[]> {
  const result = await apiRequest<{ projects: ProjectDto[] }>('/projects')
  return result.projects
}

export async function getProject(projectId: string): Promise<ProjectDetailDto> {
  const result = await apiRequest<{ project: ProjectDetailDto }>(`/projects/${projectId}`)
  return result.project
}

export async function getProjectBookText(projectId: string): Promise<string> {
  const result = await apiRequest<{ bookText: string }>(`/projects/${projectId}/book`)
  return result.bookText
}

export type CreateProjectInput = {
  title: string
  bookText?: string
  bookFile?: File
}

export async function createProject(input: CreateProjectInput): Promise<ProjectDto> {
  const body = new FormData()
  body.set('title', input.title)
  if (input.bookText !== undefined) body.set('bookText', input.bookText)
  if (input.bookFile !== undefined) body.set('bookFile', input.bookFile)

  const result = await apiRequest<{ project: ProjectDto }>('/projects', {
    method: 'POST',
    body,
  })
  return result.project
}
