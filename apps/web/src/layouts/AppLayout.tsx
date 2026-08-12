import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { useSession } from '../features/session/SessionProvider'
import './AppLayout.css'

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useSession()
  return <>
    <header className="site-header">
      <Link className="brand" to="/projects">Gradion<span>✦</span></Link>
      <nav aria-label="Primary navigation"><Link to="/projects">Projects</Link></nav>
      <div className="identity">
        <span className="avatar" aria-hidden="true">{user?.name.slice(0, 1).toUpperCase()}</span>
        <span>{user?.name}</span>
        <button className="link-button" type="button" disabled={signOut.isPending} onClick={() => signOut.mutate()}>
          {signOut.isPending ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </header>
    {children}
  </>
}
