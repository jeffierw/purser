import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PrivyRoot } from './privy.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyRoot>
      <App />
    </PrivyRoot>
  </StrictMode>,
)
