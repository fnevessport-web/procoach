import { Header } from './Header'
import { BottomNav } from './BottomNav'

export function AppLayout({ children }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      backgroundColor: '#110f0f',
    }}>
      <Header />
      <main style={{
        flex: 1, paddingBottom: '96px',
        maxWidth: '480px', width: '100%', margin: '0 auto',
        padding: '0 16px 96px',
      }}>
        {children}
      </main>
      <BottomNav />
    </div>
  )
}