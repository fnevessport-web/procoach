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
      <Header />
      <main style={{
        flex: 1,
        width: '100%',
        maxWidth: '480px',
        margin: '0 auto',
        padding: '16px 16px 96px',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}>
        {children}
      </main>
      <BottomNav />
    </div>
  )
}