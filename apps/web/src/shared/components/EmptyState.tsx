import { type ReactNode } from 'react'

export function EmptyState({ children }: { children: ReactNode }) {
  return <section className="empty-state">{children}</section>
}
