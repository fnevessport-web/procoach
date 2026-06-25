import { Header } from './Header'
import { BottomNav } from './BottomNav'

export function AppLayout({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: `
        radial-gradient(ellipse at 50% 0%, rgba(252,200,37,0.04) 0%, transparent 40%),
        radial-gradient(ellipse at 100% 100%, rgba(67,12,58,0.25) 0%, transparent 60%),
        #110f0f
      `,
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