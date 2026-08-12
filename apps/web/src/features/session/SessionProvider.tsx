import { createContext, useContext, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import { getSession, identify, sessionKey, signOut } from './api/session.api'
import type { UserDto } from '../../api/types'

type SessionContextValue = {
  user: UserDto | null | undefined
  isPending: boolean
  identify: UseMutationResult<UserDto, Error, { name: string; email: string }, unknown>
  signOut: UseMutationResult<void, Error, void, unknown>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const session = useQuery({
    queryKey: sessionKey,
    queryFn: getSession,
    staleTime: Infinity,
  })
  const identifyMutation = useMutation({
    mutationFn: identify,
    onSuccess: (user) => queryClient.setQueryData(sessionKey, user),
  })
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.clear()
      queryClient.setQueryData(sessionKey, null)
    },
  })

  return (
    <SessionContext.Provider
      value={{
        user: session.data,
        isPending: session.isPending,
        identify: identifyMutation,
        signOut: signOutMutation,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider.')
  return value
}
