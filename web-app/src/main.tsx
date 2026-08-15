import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadRuntimeConfig } from './config.ts'

// Resolve the deploy-time-injected API URL (config.ts) before the first
// render, so every hook/service sees the final config on its very first
// read rather than racing a background fetch.
void loadRuntimeConfig().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
