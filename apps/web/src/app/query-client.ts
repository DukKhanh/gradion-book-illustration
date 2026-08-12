import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

import { HttpError } from '../api/client'
import { sessionKey } from '../features/session/api/session.api'

function handleUnauthorized(error: unknown, queryClient: QueryClient) {
  if (!(error instanceof HttpError) || error.status !== 401) return

  // The server session is authoritative. A protected request that is rejected
  // must immediately make all protected routes observe an unauthenticated user.
  queryClient.setQueryData(sessionKey, null)
  queryClient.cancelQueries({ predicate: (query) => query.queryKey[0] !== sessionKey[0] })
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionKey[0] })
}

let queryClient: QueryClient

queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => handleUnauthorized(error, queryClient),
  }),
  mutationCache: new MutationCache({
    onError: (error) => handleUnauthorized(error, queryClient),
  }),
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
})

export { queryClient }
