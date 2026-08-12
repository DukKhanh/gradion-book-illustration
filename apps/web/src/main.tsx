import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './app/App.tsx'
import { AppProviders } from './app/providers.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders><App /></AppProviders>
  </StrictMode>,
)
