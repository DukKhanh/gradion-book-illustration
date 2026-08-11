import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getProjectBookText } from '../../api/projects'

type BookTextDisclosureProps = {
  projectId: string
}

export function BookTextDisclosure({ projectId }: BookTextDisclosureProps) {
  const [open, setOpen] = useState(false)

  const bookText = useQuery({
    queryKey: ['projects', projectId, 'book-text'],
    queryFn: () => getProjectBookText(projectId),
    enabled: open,
    staleTime: Infinity,
  })

  return (
    <div className="book-text-disclosure">
      <button
        className="book-text-disclosure__toggle"
        type="button"
        aria-expanded={open}
        aria-controls={`book-text-${projectId}`}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? 'Hide book text' : 'View full book text'}
        <span className="book-text-disclosure__icon" aria-hidden="true">+</span>
      </button>

      <div
        className={`book-text-disclosure__wrapper${
          open ? ' book-text-disclosure__wrapper--open' : ''
        }`}
      >
        <div className="book-text-disclosure__inner">
          <div id={`book-text-${projectId}`} className="book-text-disclosure__content">
            {bookText.isPending && (
              <p className="book-text-state" role="status">Loading book text…</p>
            )}

            {bookText.isError && (
              <div className="book-text-error">
                <p role="alert">{bookText.error.message}</p>
                <button className="secondary-button" type="button" onClick={() => bookText.refetch()}>
                  Try again
                </button>
              </div>
            )}

            {bookText.isSuccess && (
              <pre className="book-text-content">{bookText.data}</pre>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
