import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

window.addEventListener(
  'error',
  (event) => {
    try {
      const target = (event && ((event as any).target || (event as any).srcElement)) as
        | HTMLLinkElement
        | HTMLScriptElement
        | null
      const href = target && 'href' in target ? (target as HTMLLinkElement).href : ''
      const src = target && 'src' in target ? (target as HTMLScriptElement).src : ''
      const url = href || src || ''
      if (typeof url === 'string' && (url.startsWith('moz-extension://') || url.startsWith('chrome-extension://') || url.startsWith('safari-extension://'))) {
        event.stopImmediatePropagation?.()
        event.preventDefault?.()
      }
    } catch (e) {
    }
  },
  true,
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
