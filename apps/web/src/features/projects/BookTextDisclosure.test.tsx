import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import {
  cleanup,
  render,
  screen,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { getProjectBookText } from '../../api/projects'
import { BookTextDisclosure } from './BookTextDisclosure'

vi.mock(
  '../../api/projects',
  () => ({
    getProjectBookText:
      vi.fn(),
  }),
)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderDisclosure() {
  const queryClient =
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

  return render(
    <QueryClientProvider
      client={queryClient}
    >
      <BookTextDisclosure projectId="project-1" />
    </QueryClientProvider>,
  )
}

describe(
  'BookTextDisclosure',
  () => {
    it(
      'loads the full book only after the user explicitly opens it',
      async () => {
        vi.mocked(
          getProjectBookText,
        ).mockResolvedValue(
          'Chapter One\n\nFull source manuscript.',
        )

        const user =
          userEvent.setup()

        renderDisclosure()

        expect(
          getProjectBookText,
        ).not.toHaveBeenCalled()

        await user.click(
          screen.getByRole(
            'button',
            {
              name:
                /view full book text/i,
            },
          ),
        )

        expect(
          await screen.findByText(
            /Full source manuscript/,
          ),
        ).not.toBeNull()

        expect(
          getProjectBookText,
        ).toHaveBeenCalledTimes(
          1,
        )

        expect(
          getProjectBookText,
        ).toHaveBeenCalledWith(
          'project-1',
        )
      },
    )

    it(
      'reuses cached full text when closed and opened again',
      async () => {
        vi.mocked(
          getProjectBookText,
        ).mockResolvedValue(
          'Persistent source text.',
        )

        const user =
          userEvent.setup()

        renderDisclosure()

        await user.click(
          screen.getByRole(
            'button',
            {
              name:
                /view full book text/i,
            },
          ),
        )

        await screen.findByText(
          'Persistent source text.',
        )

        await user.click(
          screen.getByRole(
            'button',
            {
              name:
                /hide book text/i,
            },
          ),
        )

        await user.click(
          screen.getByRole(
            'button',
            {
              name:
                /view full book text/i,
            },
          ),
        )

        expect(
          getProjectBookText,
        ).toHaveBeenCalledTimes(
          1,
        )
      },
    )
  },
)