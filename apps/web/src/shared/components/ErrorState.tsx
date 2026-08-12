import { HttpError } from '../../api/client'

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const message = error instanceof HttpError && error.status === 404 ? 'This project could not be found.' : error.message
  return <section className="error-state" role="alert"><h1>Unable to load this page</h1><p>{message}</p>{onRetry && <button className="primary-button" onClick={onRetry}>Try again</button>}</section>
}
