import { apiRequest, HttpError } from '../../../api/client'
import type { UserDto } from '../../../api/types'

export const sessionKey = ['session'] as const

export async function getSession(): Promise<UserDto | null> {
  try {
    const result = await apiRequest<{ user: UserDto }>('/session')
    return result.user
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) return null
    throw error
  }
}

export async function identify(input: { name: string; email: string }): Promise<UserDto> {
  const result = await apiRequest<{ user: UserDto }>('/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return result.user
}

export function signOut(): Promise<void> {
  return apiRequest<void>('/session', { method: 'DELETE' })
}
