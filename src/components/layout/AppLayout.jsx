import { Header } from './Header'
import { BottomNav } from './BottomNav'

export function AppLayout({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#110f0f',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header full-width */}
      <Header />

      {/* Conteúdo centralizado */}
      <main style={{
        flex: 1,
        width: '100%',
        maxWidth: '480px',
        margin: '0 auto',
        padding: '16px 16px 96px',
        boxSizing: 'border-box',
      }}>
        {children}
      </main>

      {/* BottomNav full-width mas conteúdo centralizado */}
      <BottomNav />
    </div>
  )
}