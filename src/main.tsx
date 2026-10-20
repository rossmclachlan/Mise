import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import '@fontsource/shrikhand/latin-400.css'
import { keepPageInPlace } from './components/ui/keepPageInPlace'
import './index.css'
import App from './App.tsx'

keepPageInPlace()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
