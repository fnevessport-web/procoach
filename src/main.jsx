import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import './index.css'

// Uma aba aberta antes de um novo deploy do Vercel ainda referencia os nomes de chunk (hash)
// da build anterior — se o usuário clicar em algo que só importa dinamicamente ali (ex.:
// "Exportar PDF", que carrega o jsPDF sob demanda), o fetch desse chunk dá 404 porque o
// arquivo antigo já não existe mais no CDN. O Vite dispara esse evento especificamente nesse
// cenário; a correção é recarregar a página uma vez (ela busca o index.html novo, com os
// hashes certos) — a trava por sessionStorage evita loop infinito se o deploy atual estiver
// mesmo quebrado.
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('recarregou_apos_preload_error')) return
  sessionStorage.setItem('recarregou_apos_preload_error', '1')
  window.location.reload()
})

async function prepareApp() {
  // Remove qualquer service worker antigo
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    for (const registration of registrations) {
      await registration.unregister()
    }
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  )
}

prepareApp()