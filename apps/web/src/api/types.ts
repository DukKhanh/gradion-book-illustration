export type PipelineStep = 'STYLE' | 'CHARACTERS' | 'PORTRAITS' | 'CHAPTERS' | 'ILLUSTRATIONS'

export type UserDto = { id: string, name: string, email: string, createdAt: string }

export type PipelineDto = {
  completedStep: PipelineStep | null
  runningStep: PipelineStep | null
  stepState: 'IDLE' | 'RUNNING' | 'FAILED'
  stepStartedAt: string | null
  stepError: string | null
}

export type GeminiBookDto = {
  state: 'IDLE' | 'RUNNING' | 'FAILED' | 'READY'
  startedAt: string | null
  error: string | null
}

export type ProjectDto = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  style: string | null
  pipeline: PipelineDto
}

export type CharacterDto = {
  id: string, name: string, prompt: string, portraitUrl: string | null,
  generationStatus: string, generationError: string | null, position: number
}

export type ChapterDto = {
  id: string, name: string, prompt: string, illustrationUrl: string | null,
  generationStatus: string, generationError: string | null, position: number
}

export type ProjectDetailDto = ProjectDto & {
  geminiBook: GeminiBookDto
  characters: CharacterDto[]
  chapters: ChapterDto[]
}
