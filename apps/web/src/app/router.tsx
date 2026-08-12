import { type ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'

import { AppLayout } from '../layouts/AppLayout'
import { CreateProjectPage } from '../features/projects/pages/CreateProjectPage'
import { ProjectsPage } from '../features/projects/pages/ProjectsPage'
import { ProjectWorkspacePage } from '../features/projects/pages/ProjectWorkspacePage'
import { IdentityPage } from '../features/session/pages/IdentityPage'
import { useSession } from '../features/session/SessionProvider'

function Bootstrap() {
  return <main className="bootstrap">Checking your session…</main>
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, isPending } = useSession()
  if (isPending) return <Bootstrap />
  return user ? <Navigate to="/projects" replace /> : <>{children}</>
}

function ProtectedRoute() {
  const { user, isPending } = useSession()
  if (isPending) return <Bootstrap />
  return user ? <AppLayout><Outlet /></AppLayout> : <Navigate to="/" replace />
}

export function AppRouter() {
  return <Routes>
    <Route path="/" element={<PublicOnly><IdentityPage /></PublicOnly>} />
    <Route element={<ProtectedRoute />}>
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/new" element={<CreateProjectPage />} />
      <Route path="/projects/:projectId" element={<ProjectWorkspacePage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
