import { Header } from './Header'
import { BottomNav } from './BottomNav'

export function AppLayout({ children }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: '#110f0f',
      maxWidth: '480px',
      margin: '0 auto',
      position: 'relative',
    }}>
      <Header />
      <main style={{
        flex: 1,
        padding: '16px 16px 96px',
        width: '100%',
      }}>
        {children}
      </main>
      <BottomNav />
    </div>
  )
}